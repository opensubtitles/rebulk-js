/**
 * Rule engine — port of rebulk/rules.py
 */
import { isIterable } from './utils.js';
import { toposort } from './toposort.js';
import type { Match, Matches } from './match.js';
import type { Context } from './pattern.js';

// ─── Consequence / Condition ──────────────────────────────────────────────────

export abstract class Consequence {
  abstract then(matches: Matches, whenResponse: unknown, context: Context): unknown;
}

export abstract class Condition {
  abstract when(matches: Matches, context: Context): unknown;
}

// ─── CustomRule ───────────────────────────────────────────────────────────────

export abstract class CustomRule extends Condition implements Consequence {
  static priority = 0;
  static ruleName: string | undefined = undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static dependency: typeof CustomRule | typeof CustomRule[] | string | string[] | null | undefined = null;
  static properties: Record<string, unknown[]> = {};

  priority = (this.constructor as typeof CustomRule).priority;
  name_ = (this.constructor as typeof CustomRule).name;
  dependency_ = (this.constructor as typeof CustomRule).dependency;
  logLevel = 0;

  abstract when(matches: Matches, context: Context): unknown;
  abstract then(matches: Matches, whenResponse: unknown, context: Context): unknown;

  enabled(_context: Context): boolean {
    return true;
  }

  toString(): string {
    return `<${this.name_ ?? this.constructor.name}>`;
  }

  /** Equality: same class = same rule (for deduplication). */
  equals(other: CustomRule): boolean {
    return this.constructor === other.constructor;
  }
}

// ─── Rule ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ConsequenceClass = new (...args: any[]) => Consequence;
export type ConsequenceOrClass = Consequence | ConsequenceClass;

export abstract class Rule extends CustomRule {
  consequence: ConsequenceOrClass | ConsequenceOrClass[] | null = null;

  then(matches: Matches, whenResponse: unknown, context: Context): void {
    // Fall through to static `consequence` on the subclass if the instance property is null
    // (mirrors Python's class-attribute lookup via self.consequence)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cons = (this.consequence ?? (this.constructor as any).consequence) as ConsequenceOrClass | ConsequenceOrClass[] | null;
    if (Array.isArray(cons)) {
      const responses = Array.isArray(whenResponse) ? whenResponse : [whenResponse];
      const iter = responses[Symbol.iterator]();
      for (const c of cons) {
        const instance = typeof c === 'function' ? new (c as ConsequenceClass)() : c;
        instance.then(matches, iter.next().value, context);
      }
    } else {
      const instance = typeof cons === 'function' ? new (cons as ConsequenceClass)() : cons;
      if (instance) instance.then(matches, whenResponse, context);
    }
  }
}

// ─── Built-in Consequences ────────────────────────────────────────────────────

export class RemoveMatch extends Consequence {
  then(matches: Matches, whenResponse: unknown, _context: Context): Match | Match[] | undefined {
    if (!whenResponse) return undefined;
    if (isIterable(whenResponse) && !(whenResponse instanceof String)) {
      const ret: Match[] = [];
      for (const m of whenResponse as Iterable<Match>) {
        if (matches.includes(m)) {
          matches.remove(m);
          ret.push(m);
        }
      }
      return ret;
    }
    const m = whenResponse as Match;
    if (matches.includes(m)) {
      matches.remove(m);
      return m;
    }
    return undefined;
  }
}

export class AppendMatch extends Consequence {
  matchName: string | undefined;
  constructor(matchName?: string) {
    super();
    this.matchName = matchName;
  }
  then(matches: Matches, whenResponse: unknown, _context: Context): Match | Match[] | undefined {
    if (!whenResponse) return undefined;
    if (isIterable(whenResponse) && !(whenResponse instanceof String)) {
      const ret: Match[] = [];
      for (const m of whenResponse as Iterable<Match>) {
        if (!matches.includes(m)) {
          if (this.matchName) m.name = this.matchName;
          matches.append(m);
          ret.push(m);
        }
      }
      return ret;
    }
    const m = whenResponse as Match;
    if (this.matchName) m.name = this.matchName;
    if (!matches.includes(m)) {
      matches.append(m);
      return m;
    }
    return undefined;
  }
}

export class RenameMatch extends Consequence {
  matchName: string;
  private _remove = new RemoveMatch();
  private _append = new AppendMatch();
  constructor(matchName: string) {
    super();
    this.matchName = matchName;
  }
  then(matches: Matches, whenResponse: unknown, context: Context): void {
    const removed = this._remove.then(matches, whenResponse, context);
    if (!removed) return;
    if (Array.isArray(removed)) {
      for (const m of removed) m.name = this.matchName;
      this._append.then(matches, removed, context);
    } else {
      (removed as Match).name = this.matchName;
      this._append.then(matches, removed, context);
    }
  }
}

export class AppendTags extends Consequence {
  tags: string[];
  private _remove = new RemoveMatch();
  private _append = new AppendMatch();
  constructor(tags: string[]) {
    super();
    this.tags = tags;
  }
  then(matches: Matches, whenResponse: unknown, context: Context): void {
    const removed = this._remove.then(matches, whenResponse, context);
    if (!removed) return;
    if (Array.isArray(removed)) {
      for (const m of removed) m.tags.push(...this.tags);
    } else {
      (removed as Match).tags.push(...this.tags);
    }
    this._append.then(matches, removed, context);
  }
}

export class RemoveTags extends Consequence {
  tags: string[];
  private _remove = new RemoveMatch();
  private _append = new AppendMatch();
  constructor(tags: string[]) {
    super();
    this.tags = tags;
  }
  then(matches: Matches, whenResponse: unknown, context: Context): void {
    const removed = this._remove.then(matches, whenResponse, context);
    if (!removed) return;
    const allRemoved = Array.isArray(removed) ? removed : [removed as Match];
    for (const m of allRemoved) {
      for (const tag of this.tags) {
        const idx = m.tags.indexOf(tag);
        if (idx !== -1) m.tags.splice(idx, 1);
      }
    }
    this._append.then(matches, removed, context);
  }
}

// ─── Rules collection ────────────────────────────────────────────────────────

export class Rules {
  private _list: CustomRule[] = [];

  constructor(...rules: Array<typeof CustomRule | CustomRule>) {
    this.load(...rules);
  }

  load(...rules: Array<typeof CustomRule | CustomRule>): void {
    for (const rule of rules) {
      if (typeof rule === 'function') {
        this._list.push(new (rule as unknown as new () => CustomRule)());
      } else {
        this._list.push(rule);
      }
    }
  }

  extend(other: Rules): void {
    for (const r of other._list) {
      if (!this._list.some((existing) => existing.equals(r))) {
        this._list.push(r);
      }
    }
  }

  indexOf(rule: CustomRule): number {
    return this._list.indexOf(rule);
  }

  [Symbol.iterator](): Iterator<CustomRule> {
    return this._list[Symbol.iterator]();
  }

  get length(): number { return this._list.length; }

  executeAllRules(matches: Matches, context: Context): [CustomRule, unknown][] {
    const ret: [CustomRule, unknown][] = [];

    // Group by priority (descending numeric = higher priority first)
    const byPriority = new Map<number, CustomRule[]>();
    for (const rule of this._list) {
      const p = rule.priority;
      const arr = byPriority.get(p) ?? [];
      arr.push(rule);
      byPriority.set(p, arr);
    }

    // Sort priorities descending (highest priority runs first)
    const sortedPriorities = [...byPriority.keys()].sort((a, b) => b - a);

    for (const _priority of sortedPriorities) {
      const priorityRules = byPriority.get(_priority)!;
      const sorted = toposortRules(priorityRules);

      for (const ruleGroup of sorted) {
        // Sort group by original insertion order
        const groupArr = [...ruleGroup].sort((a, b) => this.indexOf(a) - this.indexOf(b));
        for (const rule of groupArr) {
          const whenResponse = executeRule(rule, matches, context);
          if (whenResponse !== null && whenResponse !== undefined && whenResponse !== false) {
            ret.push([rule, whenResponse]);
          }
        }
      }
    }

    return ret;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function executeRule(rule: CustomRule, matches: Matches, context: Context): unknown {
  if (!rule.enabled(context)) return null;
  const whenResponse = rule.when(matches, context);
  if (whenResponse !== null && whenResponse !== undefined && whenResponse !== false) {
    rule.then(matches, whenResponse, context);
    return whenResponse;
  }
  return null;
}

export function toposortRules(rules: CustomRule[]): Set<CustomRule>[] {
  const graph = new Map<CustomRule, Set<CustomRule>>();
  const classToDep = new Map<typeof CustomRule, CustomRule>();

  for (const rule of rules) {
    const cls = rule.constructor as typeof CustomRule;
    if (classToDep.has(cls)) {
      throw new Error(`Duplicate class rules are not allowed: ${cls.name}`);
    }
    classToDep.set(cls, rule);
  }

  for (const rule of rules) {
    const deps = new Set<CustomRule>();
    const rawDeps = rule.dependency_;
    if (rawDeps) {
      const depArr = Array.isArray(rawDeps) ? rawDeps : [rawDeps];
      for (const dep of depArr) {
        let resolved: CustomRule | undefined;
        if (typeof dep === 'string') {
          // String-based class name lookup
          for (const [cls, inst] of classToDep) {
            if ((cls as { name?: string }).name === dep) { resolved = inst; break; }
          }
        } else {
          resolved = classToDep.get(dep as typeof CustomRule);
        }
        if (resolved) deps.add(resolved);
      }
    }
    graph.set(rule, deps);
  }

  return [...toposort(graph)];
}
