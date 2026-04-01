/**
 * Pattern classes — port of rebulk/pattern.py
 * StringPattern, RePattern, FunctionalPattern
 */
import { defaultFormatter, type FormatterFn } from './formatters.js';
export type { FormatterFn } from './formatters.js';
import { ensureList, ensureDict } from 'rebulk-js';
import { getFirstDefined } from './utils.js';
import { alwaysTrue, type ValidatorFn } from './validators.js';
import { Match, Matches, type MatchOptions, type ConflictSolverFn } from './match.js';
import { findAll } from './utils.js';

export type DisabledFn = (context: Context) => boolean;
export type Context = Record<string, unknown>;
export type PostProcessorFn = (matches: Match[], pattern: BasePattern) => Match[];
export type ProcessorFn = (match: Match) => Match | null | undefined;

export interface PatternOptions extends MatchOptions {
  // Pattern-level config
  formatter?: FormatterFn | Record<string, FormatterFn>;
  value?: unknown | Record<string, unknown>;
  validator?: ValidatorFn | Record<string, ValidatorFn>;
  children?: boolean;
  every?: boolean;
  privateParent?: boolean;
  privateChildren?: boolean;
  privateNames?: string[];
  ignoreNames?: string[];
  formatAll?: boolean;
  validateAll?: boolean;
  disabled?: boolean | DisabledFn;
  logLevel?: number;
  properties?: Record<string, unknown[]>;
  postProcessor?: PostProcessorFn;
  preMatchProcessor?: ProcessorFn;
  postMatchProcessor?: ProcessorFn;
  conflictSolver?: ConflictSolverFn;
  // For RePattern
  flags?: string;
  abbreviations?: [string, string][];
  ignoreCase?: boolean;
  // Builder internal
  overrides?: string[];
  clear?: boolean;
  // Chain-specific
  chainBreaker?: (matches: Matches) => boolean;
  // extra kwargs allowed for extensibility
  [key: string]: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Filter options object for Match construction:
 * Remove keys that are Pattern-only.
 */
export function filterMatchKwargs(opts: PatternOptions, children = false): MatchOptions {
  const patternOnlyKeys: (keyof PatternOptions)[] = [
    'formatter', 'value', 'children', 'every', 'privateParent', 'privateChildren',
    'privateNames', 'ignoreNames', 'formatAll', 'validateAll', 'disabled',
    'logLevel', 'properties', 'postProcessor', 'preMatchProcessor', 'postMatchProcessor',
    'flags', 'abbreviations', 'ignoreCase', 'overrides', 'clear', 'validator',
  ];
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(opts)) {
    if (!patternOnlyKeys.includes(k as keyof PatternOptions)) {
      result[k] = v;
    }
  }
  if (children) {
    delete result['name'];
  }
  return result as MatchOptions;
}

/**
 * Convert Python named-group syntax (?P<name>...) to JS (?<name>...).
 */
function convertPythonNamedGroups(pattern: string): string {
  return pattern.replace(/\(\?P</g, '(?<');
}

/**
 * Apply abbreviation substitutions (literal string replacements).
 */
function applyAbbreviations(pattern: string, abbreviations: [string, string][]): string {
  let result = pattern;
  for (const [key, replacement] of abbreviations) {
    result = result.split(key).join(replacement);
  }
  return result;
}

/**
 * Build a compiled JS RegExp from a pattern string + options.
 * Always adds `g` flag. Converts Python named groups.
 */
function compileRegex(
  source: string,
  opts: { flags?: string; ignoreCase?: boolean; abbreviations?: [string, string][] },
): RegExp {
  let src = convertPythonNamedGroups(source);
  if (opts.abbreviations) {
    src = applyAbbreviations(src, opts.abbreviations);
  }
  let flagStr = opts.flags ?? '';
  if (opts.ignoreCase && !flagStr.includes('i')) flagStr += 'i';
  // Always add 'g' for global matching; add 'd' for indices (Node 16+/ES2022)
  if (!flagStr.includes('g')) flagStr += 'g';
  if (!flagStr.includes('d')) flagStr += 'd';
  return new RegExp(src, flagStr);
}

/**
 * Count the number of capturing groups in a regex pattern string.
 * Only counts actual capturing groups (not (?:...), (?=...), (?!...), (?<name>...)).
 * Named groups (?<name>...) ARE counted.
 */
function countGroups(source: string): number {
  let count = 0;
  let i = 0;
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === '[') {
      // Skip character class
      i++;
      while (i < source.length && source[i] !== ']') {
        if (source[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    if (source[i] === '(') {
      const next = source[i + 1];
      if (next !== '?') {
        // Unnamed capturing group
        count++;
      } else {
        const next2 = source[i + 2];
        if (next2 === '<') {
          const next3 = source[i + 3];
          if (next3 !== '=' && next3 !== '!') {
            // Named capturing group (?<name>...)
            count++;
          }
          // (?<=...) and (?<!...) are lookbehind, not capturing
        }
        // (?:...), (?=...), (?!...) → not capturing
      }
    }
    i++;
  }
  return count;
}

/**
 * Build ordered list of group names from a regex source.
 * Returns array where index corresponds to capture group number (1-based → index 0).
 * undefined means the group has no name.
 */
function buildGroupNames(source: string): (string | undefined)[] {
  const names: (string | undefined)[] = [];
  let i = 0;
  while (i < source.length) {
    if (source[i] === '\\') { i += 2; continue; }
    if (source[i] === '[') {
      i++;
      while (i < source.length && source[i] !== ']') {
        if (source[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    if (source[i] === '(') {
      const next = source[i + 1];
      if (next !== '?') {
        names.push(undefined); // unnamed group
      } else {
        const next2 = source[i + 2];
        if (next2 === '<') {
          const next3 = source[i + 3];
          if (next3 !== '=' && next3 !== '!') {
            // Named group — extract name
            const nameEnd = source.indexOf('>', i + 3);
            names.push(nameEnd !== -1 ? source.slice(i + 3, nameEnd) : undefined);
          }
          // lookbehind — not capturing, skip
        }
        // non-capturing — skip
      }
    }
    i++;
  }
  return names;
}

// ─── BasePattern ─────────────────────────────────────────────────────────────

export abstract class BasePattern {
  abstract matches(inputString: string, context?: Context, withRawMatches?: boolean): Match[] | [Match[], Match[]];
}

// ─── Pattern ─────────────────────────────────────────────────────────────────

export abstract class Pattern extends BasePattern {
  name: string | undefined;
  tags: string[];
  formatters: Record<string, FormatterFn | undefined>;
  defaultFormatterFn: FormatterFn;
  values: Record<string, unknown>;
  defaultValue: unknown;
  validators: Record<string, ValidatorFn | undefined>;
  defaultValidator: ValidatorFn;
  children: boolean;
  every: boolean;
  private_: boolean;
  privateNames: string[];
  ignoreNames: string[];
  privateParent: boolean;
  privateChildren: boolean;
  marker: boolean;
  formatAll: boolean;
  validateAll: boolean;
  disabled: DisabledFn;
  logLevel: number;
  properties_: Record<string, unknown[]> | undefined;
  postProcessor: PostProcessorFn | undefined;
  preMatchProcessor: ProcessorFn | undefined;
  postMatchProcessor: ProcessorFn | undefined;
  readonly _opts: PatternOptions;

  constructor(opts: PatternOptions = {}) {
    super();
    this._opts = opts;
    this.name = opts.name;
    this.tags = ensureList(opts.tags) as string[];

    const [formattersMap, defaultFmt] = ensureDict(opts.formatter, defaultFormatter);
    this.formatters = formattersMap as Record<string, FormatterFn | undefined>;
    this.defaultFormatterFn = (defaultFmt ?? defaultFormatter) as FormatterFn;

    const [valuesMap, defaultVal] = ensureDict(opts.value, undefined);
    this.values = valuesMap as Record<string, unknown>;
    this.defaultValue = defaultVal;

    const [validatorsMap, defaultValid] = ensureDict(opts.validator, alwaysTrue);
    this.validators = validatorsMap as Record<string, ValidatorFn | undefined>;
    this.defaultValidator = (defaultValid ?? alwaysTrue) as ValidatorFn;

    this.every = opts.every ?? false;
    this.children = opts.children ?? false;
    this.private_ = opts.private ?? false;
    this.privateNames = opts.privateNames ?? [];
    this.ignoreNames = opts.ignoreNames ?? [];
    this.privateParent = opts.privateParent ?? false;
    this.privateChildren = opts.privateChildren ?? false;
    this.marker = opts.marker ?? false;
    this.formatAll = opts.formatAll ?? false;
    this.validateAll = opts.validateAll ?? false;

    const d = opts.disabled;
    if (typeof d === 'function') {
      this.disabled = d as DisabledFn;
    } else if (typeof d === 'boolean') {
      this.disabled = () => d;
    } else {
      this.disabled = () => false;
    }

    this.logLevel = opts.logLevel ?? 0;
    this.properties_ = opts.properties;
    this.postProcessor = typeof opts.postProcessor === 'function' ? opts.postProcessor : undefined;
    this.preMatchProcessor = typeof opts.preMatchProcessor === 'function' ? opts.preMatchProcessor : undefined;
    this.postMatchProcessor = typeof opts.postMatchProcessor === 'function' ? opts.postMatchProcessor : undefined;
  }

  get shouldIncludeChildren(): boolean {
    return this.children || this.every;
  }

  get shouldIncludeParent(): boolean {
    return !this.children || this.every;
  }

  protected _matchConfigPropertyKeys(match: Match, child = false): (string | null)[] {
    const keys: (string | null)[] = [];
    if (match.name) keys.push(match.name);
    keys.push(child ? '__children__' : '__parent__');
    keys.push(null);
    return keys;
  }

  protected _processMatchPrivate(match: Match, child = false): void {
    if (
      (match.name && this.privateNames.includes(match.name)) ||
      (!child && this.privateParent) ||
      (child && this.privateChildren)
    ) {
      match.private = true;
    }
  }

  protected _processMatchValue(match: Match, child = false): void {
    const keys = this._matchConfigPropertyKeys(match, child);
    const patternValue = getFirstDefined(this.values as Record<string, unknown>, keys, this.defaultValue);
    if (patternValue !== undefined && patternValue !== null) {
      match.value = patternValue;
    }
  }

  protected _processMatchFormatter(match: Match, child = false): void {
    const included = child ? this.shouldIncludeChildren : this.shouldIncludeParent;
    if (included || this.formatAll) {
      const keys = this._matchConfigPropertyKeys(match, child);
      match.formatter = getFirstDefined(this.formatters as Record<string, unknown>, keys, this.defaultFormatterFn) as FormatterFn | undefined;
    }
  }

  protected _processMatchValidator(match: Match, child = false): boolean {
    const included = child ? this.shouldIncludeChildren : this.shouldIncludeParent;
    if (included || this.validateAll) {
      const keys = this._matchConfigPropertyKeys(match, child);
      const validator = getFirstDefined(this.validators as Record<string, unknown>, keys, this.defaultValidator) as ValidatorFn | undefined;
      if (validator && !validator(match)) return false;
    }
    return true;
  }

  protected _processMatch(match: Match, matchIndex: number, child = false): boolean {
    match.matchIndex = matchIndex;
    this._processMatchPrivate(match, child);
    this._processMatchValue(match, child);
    this._processMatchFormatter(match, child);
    return this._processMatchValidator(match, child);
  }

  protected static _applyProcessor(match: Match | null | undefined, processor: ProcessorFn | undefined): Match | null | undefined {
    if (!processor) return match;
    if (!match) return match;
    const ret = processor(match);
    return ret !== undefined ? ret : match;
  }

  protected *_processMatches(match: Match, matchIndex: number): Generator<Match> {
    const processed = Pattern._applyProcessor(match, this.preMatchProcessor);
    if (!processed) return;

    if (!this._processMatch(processed, matchIndex)) return;

    for (const child of processed.children) {
      if (!this._processMatch(child, matchIndex, true)) return;
    }

    const postProcessed = Pattern._applyProcessor(processed, this.postMatchProcessor);
    if (!postProcessed) return;

    if ((this.shouldIncludeParent || this.privateParent) && !this.ignoreNames.includes(postProcessed.name ?? '')) {
      yield postProcessed;
    }
    if (this.shouldIncludeChildren || this.privateChildren) {
      for (const child of postProcessed.children) {
        if (!this.ignoreNames.includes(child.name ?? '')) yield child;
      }
    }
  }

  protected _postProcessMatches(matches: Match[]): Match[] {
    if (this.postProcessor) return this.postProcessor(matches, this);
    return matches;
  }

  override matches(inputString: string, context?: Context, withRawMatches = false): Match[] | [Match[], Match[]] {
    const allMatches: Match[] = [];
    const rawMatches: Match[] = [];

    for (const pattern of this.patterns) {
      let matchIndex = 0;
      for (const rawMatch of this._match(pattern, inputString, context)) {
        rawMatches.push(rawMatch);
        for (const m of this._processMatches(rawMatch, matchIndex)) {
          allMatches.push(m);
        }
        matchIndex++;
      }
    }

    const finalMatches = this._postProcessMatches(allMatches);

    if (withRawMatches) return [finalMatches, rawMatches];
    return finalMatches;
  }

  abstract get patterns(): unknown[];
  abstract get matchOptions(): MatchOptions;
  abstract _match(pattern: unknown, inputString: string, context?: Context): Generator<Match>;

  get properties(): Record<string, unknown[]> {
    return this.properties_ ?? {};
  }
}

// ─── StringPattern ────────────────────────────────────────────────────────────

export class StringPattern extends Pattern {
  private _patterns: string[];
  private _matchKwargs: MatchOptions;

  constructor(...patterns: string[]);
  constructor(opts: PatternOptions, ...patterns: string[]);
  constructor(firstArg: PatternOptions | string, ...rest: string[]) {
    if (typeof firstArg === 'string') {
      super({});
      this._patterns = [firstArg, ...rest];
      this._matchKwargs = filterMatchKwargs({});
    } else {
      super(firstArg);
      this._patterns = rest;
      this._matchKwargs = filterMatchKwargs(firstArg);
    }
  }

  get patterns(): string[] { return this._patterns; }
  get matchOptions(): MatchOptions { return this._matchKwargs; }

  *_match(pattern: string, inputString: string, _context?: Context): Generator<Match> {
    const ignoreCase = (this._opts.ignoreCase ?? false) ||
      (this._opts.flags?.includes('i') ?? false);
    for (const idx of findAll(inputString, pattern, 0, undefined, ignoreCase)) {
      const match = new Match(idx, idx + pattern.length, {
        ...this._matchKwargs,
        pattern: this,
        inputString,
      });
      if (match.length > 0) yield match;
    }
  }
}

// ─── RePattern ───────────────────────────────────────────────────────────────

export class RePattern extends Pattern {
  private _regexes: RegExp[];
  private _matchKwargs: MatchOptions;
  private _childrenMatchKwargs: MatchOptions;
  private _groupNamesList: (string | undefined)[][];

  constructor(opts: PatternOptions, ...patterns: (string | RegExp)[]) {
    super(opts);
    this._matchKwargs = filterMatchKwargs(opts);
    this._childrenMatchKwargs = filterMatchKwargs(opts, true);

    this._regexes = [];
    this._groupNamesList = [];

    for (const p of patterns) {
      if (p instanceof RegExp) {
        this._regexes.push(p);
        this._groupNamesList.push(buildGroupNames(p.source));
      } else {
        const compiled = compileRegex(p, {
          flags: opts.flags,
          ignoreCase: opts.ignoreCase,
          abbreviations: opts.abbreviations,
        });
        this._regexes.push(compiled);
        this._groupNamesList.push(buildGroupNames(compiled.source));
      }
    }
  }

  get patterns(): RegExp[] { return this._regexes; }
  get matchOptions(): MatchOptions { return this._matchKwargs; }

  *_match(pattern: RegExp, inputString: string, _context?: Context): Generator<Match> {
    const groupNames = this._groupNamesList[this._regexes.indexOf(pattern)] ?? [];
    // Reset lastIndex
    pattern.lastIndex = 0;

    let m: RegExpExecArray | null;
    while ((m = pattern.exec(inputString)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;

      const mainMatch = new Match(start, end, {
        ...this._matchKwargs,
        pattern: this,
        inputString,
      });

      // Process capturing groups
      if (groupNames.length > 0) {
        const indices = (m as any).indices as Array<[number, number] | undefined> | undefined;
        for (let i = 0; i < groupNames.length; i++) {
          const groupIdx = i + 1; // 1-based
          const name = groupNames[i] ?? this.name;
          const groupIndices = indices?.[groupIdx];
          if (groupIndices && groupIndices[0] !== -1) {
            const [gs, ge] = groupIndices;
            const childMatch = new Match(gs, ge, {
              ...this._childrenMatchKwargs,
              name,
              parent: mainMatch,
              pattern: this,
              inputString,
            });
            if (childMatch.length > 0) mainMatch.children.append(childMatch);
          }
        }
      }

      if (mainMatch.length > 0 || m[0].length === 0) {
        if (mainMatch.length > 0) yield mainMatch;
      }

      // Safety: prevent infinite loops on zero-length matches
      if (m[0].length === 0) pattern.lastIndex++;
    }
  }
}

// ─── FunctionalPattern ────────────────────────────────────────────────────────

type FunctionalPatternFn = (inputString: string, context?: Context) => FunctionalResult;
type FunctionalResult =
  | null
  | undefined
  | false
  | [number, number]
  | [number, number, Partial<MatchOptions>]
  | Partial<MatchOptions>
  | Array<[number, number] | [number, number, Partial<MatchOptions>] | Partial<MatchOptions>>;

export class FunctionalPattern extends Pattern {
  private _fns: FunctionalPatternFn[];
  private _matchKwargs: MatchOptions;

  constructor(opts: PatternOptions, ...fns: FunctionalPatternFn[]) {
    super(opts);
    this._fns = fns;
    this._matchKwargs = filterMatchKwargs(opts);
  }

  get patterns(): FunctionalPatternFn[] { return this._fns; }
  get matchOptions(): MatchOptions { return this._matchKwargs; }

  *_match(fn: FunctionalPatternFn, inputString: string, context?: Context): Generator<Match> {
    const ret = fn(inputString, context);
    if (!ret) return;

    const isSpan = (v: unknown): v is [number, number] =>
      Array.isArray(v) && v.length === 2 && typeof v[0] === 'number';

    const args_iterable: FunctionalResult[] = Array.isArray(ret) && !isSpan(ret) ? ret as FunctionalResult[] : [ret];

    for (const args of args_iterable) {
      if (!args) continue;
      if (typeof args === 'object' && !Array.isArray(args)) {
        // Dict form
        const opts = { ...this._matchKwargs, ...(args as Partial<MatchOptions>) };
        const m = new Match((opts as any).start ?? 0, (opts as any).end ?? 0, {
          ...opts,
          pattern: this,
          inputString,
        });
        if (m.length > 0) yield m;
      } else if (Array.isArray(args)) {
        let matchOpts: MatchOptions = this._matchKwargs;
        let start: number, end: number;
        const lastEl = args[args.length - 1];
        if (typeof lastEl === 'object' && !Array.isArray(lastEl) && typeof (lastEl as any)[0] !== 'number') {
          matchOpts = { ...this._matchKwargs, ...(lastEl as Partial<MatchOptions>) };
          [start, end] = args as [number, number];
        } else {
          [start, end] = args as [number, number];
        }
        const m = new Match(start, end, { ...matchOpts, pattern: this, inputString });
        if (m.length > 0) yield m;
      }
    }
  }
}
