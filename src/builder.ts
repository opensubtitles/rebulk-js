/**
 * Builder base class — port of rebulk/builder.py
 */
import { StringPattern, RePattern, FunctionalPattern, type PatternOptions } from './pattern.js';
import { setDefaults } from './loose.js';
import { getChainClass } from './_chainBridge.js';
import type { BasePattern } from './pattern.js';

/**
 * Split args into (patterns[], opts) supporting both:
 *   (opts, ...patterns)     — opts-first style
 *   (...patterns, opts)     — opts-last style
 *   (...patterns)           — patterns only
 */
function splitPatternsOpts(args: (string | PatternOptions)[]): [string[], PatternOptions] {
  if (args.length === 0) return [[], {}];
  const first = args[0];
  const last = args[args.length - 1];
  // opts-first: first arg is object
  if (typeof first === 'object' && first !== null) {
    return [args.slice(1) as string[], first as PatternOptions];
  }
  // opts-last: last arg is object
  if (args.length > 1 && typeof last === 'object' && last !== null) {
    return [args.slice(0, -1) as string[], last as PatternOptions];
  }
  // all strings
  return [args as string[], {}];
}

export abstract class Builder {
  protected _defaults: Record<string, unknown> = {};
  protected _regexDefaults: Record<string, unknown> = {};
  protected _stringDefaults: Record<string, unknown> = {};
  protected _functionalDefaults: Record<string, unknown> = {};
  protected _chainDefaults: Record<string, unknown> = {};

  reset(): this {
    this._defaults = {};
    this._regexDefaults = {};
    this._stringDefaults = {};
    this._functionalDefaults = {};
    this._chainDefaults = {};
    return this;
  }

  defaults(kwargs: Record<string, unknown>): this {
    setDefaults(kwargs, this._defaults, true);
    return this;
  }

  regexDefaults(kwargs: Record<string, unknown>): this {
    setDefaults(kwargs, this._regexDefaults, true);
    return this;
  }

  stringDefaults(kwargs: Record<string, unknown>): this {
    setDefaults(kwargs, this._stringDefaults, true);
    return this;
  }

  functionalDefaults(kwargs: Record<string, unknown>): this {
    setDefaults(kwargs, this._functionalDefaults, true);
    return this;
  }

  chainDefaults(kwargs: Record<string, unknown>): this {
    setDefaults(kwargs, this._chainDefaults, true);
    return this;
  }

  private _applyOverrides(kwargs: Record<string, unknown>): [Record<string, unknown>, Record<string, unknown>] {
    const overrideKeys = (kwargs['overrides'] as string[] | undefined) ?? [];
    delete kwargs['overrides'];
    const backup: Record<string, unknown> = {};
    for (const k of overrideKeys) backup[k] = kwargs[k];
    return [kwargs, backup];
  }

  buildRe(opts: PatternOptions, ...patterns: string[]): RePattern {
    const kwargs: Record<string, unknown> = { ...opts };
    const [, backup] = this._applyOverrides(kwargs);
    setDefaults(this._regexDefaults, kwargs);
    setDefaults(this._defaults, kwargs);
    Object.assign(kwargs, backup);
    return new RePattern(kwargs as PatternOptions, ...patterns);
  }

  buildString(opts: PatternOptions, ...patterns: string[]): StringPattern {
    const kwargs: Record<string, unknown> = { ...opts };
    const [, backup] = this._applyOverrides(kwargs);
    setDefaults(this._stringDefaults, kwargs);
    setDefaults(this._defaults, kwargs);
    Object.assign(kwargs, backup);
    return new StringPattern(kwargs as PatternOptions, ...patterns);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildFunctional(opts: PatternOptions, ...fns: ((...args: any[]) => any)[]): FunctionalPattern {
    const kwargs: Record<string, unknown> = { ...opts };
    const [, backup] = this._applyOverrides(kwargs);
    setDefaults(this._functionalDefaults, kwargs);
    setDefaults(this._defaults, kwargs);
    Object.assign(kwargs, backup);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new FunctionalPattern(kwargs as PatternOptions, ...fns as any);
  }

  /**
   * Fluent API: add a regex pattern and return `this`.
   * Supports both:
   *   regex(opts, 'pat1', 'pat2')  — options-first
   *   regex('pat1', 'pat2', opts)  — patterns-first, opts last
   *   regex('pat1', 'pat2')        — patterns only
   */
  regex(...args: (string | PatternOptions)[]): this {
    const [patterns, opts] = splitPatternsOpts(args);
    const p = this.buildRe(opts, ...patterns);
    return this.pattern(p);
  }

  /**
   * Fluent API: add a string pattern and return `this`.
   */
  string(...args: (string | PatternOptions)[]): this {
    const [patterns, opts] = splitPatternsOpts(args);
    const p = this.buildString(opts, ...patterns);
    return this.pattern(p);
  }

  /**
   * Fluent API: add a functional pattern and return `this`.
   * Supports:
   *   functional(fn)                — function only
   *   functional(fn, opts)          — fn-first, opts-last (Python style)
   *   functional(opts, fn)          — opts-first, fn-last
   *   functional(opts, fn1, fn2, …) — opts-first, multiple fns
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  functional(opts: PatternOptions | ((...args: any[]) => any), ...fns: (PatternOptions | ((...args: any[]) => any))[]): this {
    let p: FunctionalPattern;
    if (typeof opts === 'function') {
      // fn-first style: check if last arg is an opts object
      const lastArg = fns[fns.length - 1];
      if (fns.length > 0 && typeof lastArg === 'object' && lastArg !== null && !Array.isArray(lastArg)) {
        const o = lastArg as PatternOptions;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actualFns = fns.slice(0, -1) as ((...args: any[]) => any)[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p = this.buildFunctional(o, opts as (...args: any[]) => any, ...actualFns);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p = this.buildFunctional({}, opts as (...args: any[]) => any, ...fns as ((...args: any[]) => any)[]);
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      p = this.buildFunctional(opts, ...fns as ((...args: any[]) => any)[]);
    }
    return this.pattern(p);
  }

  /**
   * Fluent API: start a chain and return it.
   * The chain is also registered via pattern().
   */
  chain(opts: PatternOptions = {}): import('./chain.js').Chain {
    const ChainCtor = getChainClass();
    if (!ChainCtor) throw new Error('Chain class not registered. Import chain.ts before calling chain().');
    const kwargs: Record<string, unknown> = { ...opts };
    setDefaults(this._chainDefaults, kwargs);
    setDefaults(this._defaults, kwargs);
    const c = new ChainCtor(this, kwargs as PatternOptions);
    c._defaults = { ...this._defaults };
    c._regexDefaults = { ...this._regexDefaults };
    c._stringDefaults = { ...this._stringDefaults };
    c._functionalDefaults = { ...this._functionalDefaults };
    c._chainDefaults = { ...this._chainDefaults };
    this.pattern(c);
    return c;
  }

  abstract pattern(...patterns: BasePattern[]): this;
}
