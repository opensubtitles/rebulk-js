/**
 * Rebulk — port of rebulk/rebulk.py
 */
import { Builder } from './builder.js';
import { Match, Matches } from './match.js';
import { Rules } from './rules.js';
import { ConflictSolver, PrivateRemover } from './processors.js';
import { extendSafe } from './utils.js';
import type { BasePattern, Context, PatternOptions } from './pattern.js';

export class Rebulk extends Builder {
  private _patterns: BasePattern[] = [];
  private _rules: Rules;
  private _rebulks: Rebulk[] = [];
  private _disabled: (context: Context) => boolean;

  /** Optional property customizer (guessit-specific). */
  customizeProperties?: (props: Record<string, unknown[]>) => Record<string, unknown[]>;

  constructor(opts: { disabled?: boolean | ((ctx: Context) => boolean); defaultRules?: boolean } = {}) {
    super();
    const d = opts.disabled;
    if (typeof d === 'function') {
      this._disabled = d as (ctx: Context) => boolean;
    } else if (typeof d === 'boolean') {
      this._disabled = () => d;
    } else {
      this._disabled = () => false;
    }

    this._rules = new Rules();
    if (opts.defaultRules !== false) {
      this._rules.load(ConflictSolver, PrivateRemover);
    }
  }

  override pattern(...patterns: BasePattern[]): this {
    this._patterns.push(...patterns);
    return this;
  }

  rules(...rules: Array<typeof import('./rules.js').CustomRule | import('./rules.js').CustomRule>): this {
    this._rules.load(...rules);
    return this;
  }

  rebulk(...rebulks: Rebulk[]): this {
    this._rebulks.push(...rebulks);
    return this;
  }

  /** Run all patterns and rules against `string`. */
  matches(string: string, context: Context = {}): Matches {
    const matches = new Matches(undefined, string);

    this._matchesPatterns(matches, context);
    this._executeRules(matches, context);

    return matches;
  }

  effectiveRules(context?: Context): Rules {
    const rules = new Rules();
    rules.extend(this._rules);
    for (const child of this._rebulks) {
      if (!child._disabled(context ?? {})) {
        rules.extend(child._rules);
      }
    }
    return rules;
  }

  effectivePatterns(context?: Context): BasePattern[] {
    const patterns = [...this._patterns];
    for (const child of this._rebulks) {
      if (!child._disabled(context ?? {})) {
        extendSafe(patterns, child._patterns);
      }
    }
    return patterns;
  }

  private _executeRules(matches: Matches, context: Context): void {
    if (!this._disabled(context)) {
      const rules = this.effectiveRules(context);
      rules.executeAllRules(matches, context);
    }
  }

  private _matchesPatterns(matches: Matches, context: Context): void {
    if (this._disabled(context)) return;

    const patterns = this.effectivePatterns(context);
    for (const pat of patterns) {
      if ((pat as any).disabled && (pat as any).disabled(context)) continue;
      const patternMatches = pat.matches(matches.inputString!, context) as Match[];
      for (const m of patternMatches) {
        if (m.marker) {
          matches.markers.append(m);
        } else {
          matches.append(m);
        }
      }
    }
  }
}

// Re-export all rebulk public API from a single entry point
export { Builder } from './builder.js';
export { Chain, ChainPart } from './chain.js';
export { Match, Matches, Markers, MatchesDict } from './match.js';
export {
  BasePattern, Pattern, StringPattern, RePattern, FunctionalPattern,
  filterMatchKwargs,
} from './pattern.js';
export {
  Rule, CustomRule, Rules, Consequence, Condition,
  RemoveMatch, AppendMatch, RenameMatch, AppendTags, RemoveTags,
  executeRule, toposortRules,
} from './rules.js';
export { ConflictSolver, PrivateRemover } from './processors.js';
export { alwaysTrue, charsBefore, charsAfter, charsSurround } from './validators.js';
export { defaultFormatter, formatters } from './formatters.js';
export { toposort, toposortFlatten } from './toposort.js';
export { findAll, isIterable, extendSafe, IdentitySet } from './utils.js';
export type { PatternOptions, Context, DisabledFn, FormatterFn as FormatterFnType } from './pattern.js';
export type { ValidatorFn } from './validators.js';
export type { ConflictSolverFn, MatchOptions } from './match.js';
