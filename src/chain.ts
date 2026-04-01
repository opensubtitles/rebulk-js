/**
 * Chain pattern — port of rebulk/chain.py
 */
import { Pattern, BasePattern, filterMatchKwargs, type PatternOptions, type Context } from './pattern.js';
import { Builder } from './builder.js';
import { Match, Matches } from './match.js';
import { RePattern, StringPattern, FunctionalPattern } from './pattern.js';
import { setDefaults } from './loose.js';
import { registerChain } from './_chainBridge.js';

class InvalidChainException extends Error {
  constructor() { super('Invalid chain'); }
}

// ─── ChainPart ─────────────────────────────────────────────────────────────

export class ChainPart extends BasePattern {
  readonly _chain: Chain;
  readonly pattern: Pattern | BasePattern;
  repeaterStart = 1;
  repeaterEnd: number | null = 1;
  private _hidden = false;

  constructor(chain: Chain, pattern: Pattern | BasePattern) {
    super();
    this._chain = chain;
    this.pattern = pattern;
  }

  get isChainStart(): boolean {
    return this._chain.parts[0] === this;
  }

  get isHidden(): boolean {
    return this._hidden;
  }

  hidden(hidden = true): this {
    this._hidden = hidden;
    return this;
  }

  override matches(inputString: string, context?: Context, withRawMatches = false): Match[] | [Match[], Match[]] {
    const result = this.pattern.matches(inputString, context, true) as [Match[], Match[]];
    let [allMatches, rawMatches] = result;

    allMatches = this._truncateRepeater(allMatches, inputString);
    rawMatches = this._truncateRepeater(rawMatches, inputString);
    this._validateRepeater(rawMatches);

    if (withRawMatches) return [allMatches, rawMatches];
    return allMatches;
  }

  private _truncateRepeater(matches: Match[], inputString: string): Match[] {
    if (!matches.length) return matches;

    if (!this.isChainStart) {
      const separator = inputString.slice(0, matches[0].initiator.rawStart);
      if (separator) return [];
    }

    let j = 1;
    for (let i = 0; i < matches.length - 1; i++) {
      const sep = inputString.slice(matches[i].initiator.rawEnd, matches[i + 1].initiator.rawStart);
      if (sep) break;
      j++;
    }

    let truncated = matches.slice(0, j);
    if (this.repeaterEnd !== null) {
      truncated = truncated.filter((m) => m.matchIndex < this.repeaterEnd!);
    }
    return truncated;
  }

  private _validateRepeater(matches: Match[]): void {
    const maxMatchIndex = matches.length > 0
      ? Math.max(...matches.map((m) => m.matchIndex))
      : -1;
    if (maxMatchIndex + 1 < this.repeaterStart) {
      throw new InvalidChainException();
    }
  }

  repeater(value: string | number): this {
    if (typeof value === 'number') {
      this.repeaterStart = value;
      this.repeaterEnd = value;
      return this;
    }
    const v = String(value);
    if (v === '+') {
      this.repeaterStart = 1;
      this.repeaterEnd = null;
    } else if (v === '*') {
      this.repeaterStart = 0;
      this.repeaterEnd = null;
    } else if (v === '?') {
      this.repeaterStart = 0;
      this.repeaterEnd = 1;
    } else {
      const m = /\{\s*(\d*)\s*,?\s*(\d*)\s*\}/.exec(v);
      if (m) {
        this.repeaterStart = m[1] ? parseInt(m[1]) : 0;
        this.repeaterEnd = m[2] ? parseInt(m[2]) : null;
      }
    }
    return this;
  }

  // Proxy chain methods for fluent API
  regex(opts: PatternOptions | string, ...rest: string[]): ChainPart {
    return this._chain.regex(opts as any, ...rest) as unknown as ChainPart;
  }
  string(opts: PatternOptions | string, ...rest: string[]): ChainPart {
    return this._chain.string(opts as any, ...rest) as unknown as ChainPart;
  }
  functional(opts: PatternOptions | ((...a: unknown[]) => unknown), ...fns: ((...a: unknown[]) => unknown)[]): ChainPart {
    return this._chain.functional(opts as any, ...fns) as unknown as ChainPart;
  }
  chain(opts?: PatternOptions): Chain {
    return this._chain.chain(opts) as Chain;
  }
  close(): import('./rebulk.js').Rebulk {
    return this._chain.close();
  }

  toString(): string {
    return `${this.pattern}({${this.repeaterStart},${this.repeaterEnd}})`;
  }
}

// ─── Chain ────────────────────────────────────────────────────────────────────

export class Chain extends Pattern {
  parts: ChainPart[] = [];
  // Builder-compatible defaults (populated by Builder.chain())
  _defaults: Record<string, unknown> = {};
  _regexDefaults: Record<string, unknown> = {};
  _stringDefaults: Record<string, unknown> = {};
  _functionalDefaults: Record<string, unknown> = {};
  _chainDefaults: Record<string, unknown> = {};
  private _parent: Builder;
  private _chainBreaker: ((matches: Matches) => boolean) | null;
  private _matchKwargs: ReturnType<typeof filterMatchKwargs>;

  constructor(parent: Builder, opts: PatternOptions = {}) {
    super(opts);
    this._parent = parent;
    this._matchKwargs = filterMatchKwargs(opts);
    this._chainBreaker = (opts as unknown as { chainBreaker?: (m: Matches) => boolean }).chainBreaker ?? null;
  }

  // Builder-like methods so chain().regex() etc. work
  defaults(kwargs: Record<string, unknown>): this {
    setDefaults(kwargs, this._defaults, true);

    // Also apply relevant settings to the Chain Pattern itself, mirroring what Python rebulk
    // does implicitly (defaults flow into the chain's own match-processing logic).
    if ('children' in kwargs) this.children = kwargs.children as boolean;
    if ('privateParent' in kwargs) this.privateParent = kwargs.privateParent as boolean;
    if ('privateChildren' in kwargs) this.privateChildren = kwargs.privateChildren as boolean;
    if ('conflictSolver' in kwargs) (this._matchKwargs as Record<string, unknown>).conflictSolver = kwargs.conflictSolver;
    if ('privateNames' in kwargs) this.privateNames = kwargs.privateNames as string[];

    return this;
  }

  regexDefaults(kwargs: Record<string, unknown>): this {
    setDefaults(kwargs, this._regexDefaults, true);
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  regex(...args: any[]): ChainPart {
    const lastArg = args[args.length - 1];
    const opts: PatternOptions = (typeof lastArg === 'object' && lastArg !== null && !Array.isArray(lastArg)) ? lastArg as PatternOptions : {};
    const patterns: string[] = typeof lastArg === 'object' && lastArg !== null && !Array.isArray(lastArg) ? args.slice(0, -1) as string[] : args as string[];
    const kwargs: PatternOptions = { ...this._regexDefaults, ...this._defaults, ...opts } as PatternOptions;
    const pat = new RePattern(kwargs, ...patterns);
    return this.pattern(pat);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  string(...args: any[]): ChainPart {
    const lastArg = args[args.length - 1];
    const opts: PatternOptions = (typeof lastArg === 'object' && lastArg !== null && !Array.isArray(lastArg)) ? lastArg as PatternOptions : {};
    const patterns: string[] = typeof lastArg === 'object' && lastArg !== null && !Array.isArray(lastArg) ? args.slice(0, -1) as string[] : args as string[];
    const kwargs: PatternOptions = { ...this._stringDefaults, ...this._defaults, ...opts } as PatternOptions;
    const pat = new StringPattern(kwargs, ...patterns);
    return this.pattern(pat);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  functional(...args: any[]): ChainPart {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = args[0] as (...a: any[]) => any;
    const opts: PatternOptions = (args.length > 1 && typeof args[1] === 'object' ? args[1] : {}) as PatternOptions;
    const kwargs: PatternOptions = { ...this._functionalDefaults, ...this._defaults, ...opts } as PatternOptions;
    const pat = new FunctionalPattern(kwargs, fn);
    return this.pattern(pat);
  }

  chain(opts: PatternOptions = {}): Chain {
    const kwargs: Record<string, unknown> = { ...this._chainDefaults, ...this._defaults, ...opts };
    const c = new Chain(this as unknown as Builder, kwargs as PatternOptions);
    c._defaults = { ...this._defaults };
    c._regexDefaults = { ...this._regexDefaults };
    c._stringDefaults = { ...this._stringDefaults };
    c._functionalDefaults = { ...this._functionalDefaults };
    c._chainDefaults = { ...this._chainDefaults };
    this.pattern(c);
    return c;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pattern(...patterns: (Pattern | BasePattern | any)[]): ChainPart {
    if (!patterns.length) throw new Error('One pattern should be given to the chain');
    if (patterns.length > 1) throw new Error('Only one pattern can be given to the chain');
    const part = new ChainPart(this, patterns[0]);
    this.parts.push(part);
    return part;
  }

  close(): import('./rebulk.js').Rebulk {
    let p: Builder = this._parent;
    while (p instanceof Chain) p = (p as Chain)._parent;
    return p as import('./rebulk.js').Rebulk;
  }

  override get patterns(): [Chain] { return [this]; }
  override get matchOptions() { return {}; }

  override *_match(_pattern: unknown, inputString: string, context?: Context): Generator<Match> {
    let offset = 0;
    while (offset < inputString.length) {
      let chainFound = false;
      const currentChainMatches: Match[] = [];
      let valid = true;
      let chainInputString = inputString.slice(offset);

      for (const chainPart of this.parts) {
        try {
          const result = chainPart.matches(chainInputString, context, true) as [Match[], Match[]];
          const [partMatches, rawPartMatches] = result;

          // Fix offsets
          Chain._fixMatchesOffset(partMatches, inputString, offset);
          Chain._fixMatchesOffset(rawPartMatches, inputString, offset);

          if (rawPartMatches.length > 0) {
            const groupedRaw = Chain._groupByMatchIndex(rawPartMatches);
            const groupedAll = Chain._groupByMatchIndex(partMatches);

            for (const [matchIndex, grouped] of groupedRaw) {
              chainFound = true;
              offset = grouped[grouped.length - 1].rawEnd;
              chainInputString = inputString.slice(offset);

              if (!chainPart.isHidden) {
                const groupedMatches = groupedAll.get(matchIndex) ?? [];
                if (this._chainBreakerEval([...currentChainMatches, ...groupedMatches])) {
                  currentChainMatches.push(...groupedMatches);
                }
              }
            }
          }
        } catch (e) {
          if (e instanceof InvalidChainException) {
            valid = false;
            if (currentChainMatches.length > 0) {
              offset = currentChainMatches[0].rawEnd;
            } else {
              offset++;
            }
            break;
          }
          throw e;
        }
      }

      if (!chainFound) break;

      if (currentChainMatches.length > 0 && valid) {
        yield this._buildChainMatch(currentChainMatches, inputString);
      }
    }
  }

  private _chainBreakerEval(matches: Match[]): boolean {
    if (!this._chainBreaker) return true;
    return !this._chainBreaker(new Matches(matches));
  }

  private _buildChainMatch(currentChainMatches: Match[], inputString: string): Match {
    let start = Infinity;
    let end = -Infinity;
    for (const m of currentChainMatches) {
      if (m.start < start) start = m.start;
      if (m.end > end) end = m.end;
    }

    const match = new Match(start, end, {
      ...this._matchKwargs,
      pattern: this,
      inputString,
    });

    for (const chainMatch of currentChainMatches) {
      if (chainMatch.children.length > 0) {
        for (const child of chainMatch.children) {
          match.children.append(child);
        }
      }
      if (!match.children.includes(chainMatch)) {
        match.children.append(chainMatch);
        chainMatch.parent = match;
      }
    }

    return match;
  }

  private static _fixMatchesOffset(matches: Match[], inputString: string, offset: number): void {
    for (const m of matches) {
      if (m.inputString !== inputString) {
        m.inputString = inputString;
        // Read rawStart/rawEnd BEFORE modifying start/end, because the getter
        // falls back to `this.start` when _rawStart is undefined — if start is
        // already updated, we'd double-count the offset.
        const oldRawStart = m.rawStart;
        const oldRawEnd = m.rawEnd;
        m.start += offset;
        m.end += offset;
        m.rawStart = oldRawStart + offset;
        m.rawEnd = oldRawEnd + offset;
      }
      if (m.children.length > 0) {
        Chain._fixMatchesOffset(m.children.toArray(), inputString, offset);
      }
    }
  }

  private static _groupByMatchIndex(matches: Match[]): Map<number, Match[]> {
    const map = new Map<number, Match[]>();
    for (const m of matches) {
      const arr = map.get(m.matchIndex) ?? [];
      arr.push(m);
      map.set(m.matchIndex, arr);
    }
    return map;
  }
}

// Register Chain class so builder.ts can access it without circular import
registerChain(Chain);
