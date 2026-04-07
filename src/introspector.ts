/**
 * Introspect rebulk object to retrieve capabilities — port of rebulk/introspector.py
 */
import { StringPattern, RePattern, FunctionalPattern } from './pattern.js';
import type { BasePattern } from './pattern.js';
import type { CustomRule } from './rules.js';
import { extendSafe } from './utils.js';

export abstract class Description {
  abstract get properties(): Record<string, unknown[]>;
}

export class PatternDescription extends Description {
  pattern: BasePattern;
  private _properties: Record<string, unknown[]>;

  constructor(pattern: BasePattern) {
    super();
    this.pattern = pattern;
    this._properties = {};

    const pat = pattern as any;

    if (pat.properties_ && Object.keys(pat.properties_).length > 0) {
      for (const [key, values] of Object.entries(pat.properties_)) {
        if (!this._properties[key]) this._properties[key] = [];
        extendSafe(this._properties[key] as any[], values as any[]);
      }
    } else if (pat.defaultValue !== undefined && pat.defaultValue !== null) {
      const name = pat.name ?? '';
      if (!this._properties[name]) this._properties[name] = [];
      this._properties[name].push(pat.defaultValue);
    } else if (pattern instanceof StringPattern) {
      const name = pat.name ?? '';
      if (!this._properties[name]) this._properties[name] = [];
      extendSafe(this._properties[name] as any[], pat.patterns);
    } else if (pattern instanceof RePattern) {
      if (pat.name && !(pat.privateNames || []).includes(pat.name)) {
        if (!this._properties[pat.name]) this._properties[pat.name] = [];
        extendSafe(this._properties[pat.name], [null]);
      }
      if (!pat.privateChildren) {
        for (const regex of pat.patterns) {
          if (regex.source) {
            // Extract named groups from regex
            const groupRegex = /\(\?<([^>]+)>/g;
            let m: RegExpExecArray | null;
            while ((m = groupRegex.exec(regex.source)) !== null) {
              const groupName = m[1];
              if (!(pat.privateNames || []).includes(groupName)) {
                if (!this._properties[groupName]) this._properties[groupName] = [];
                extendSafe(this._properties[groupName], [null]);
              }
            }
          }
        }
      }
    } else if (pattern instanceof FunctionalPattern) {
      if (pat.name && !(pat.privateNames || []).includes(pat.name)) {
        if (!this._properties[pat.name]) this._properties[pat.name] = [];
        extendSafe(this._properties[pat.name], [null]);
      }
    }
  }

  get properties(): Record<string, unknown[]> {
    return this._properties;
  }
}

export class RuleDescription extends Description {
  rule: CustomRule;
  private _properties: Record<string, unknown[]>;

  constructor(rule: CustomRule) {
    super();
    this.rule = rule;
    this._properties = {};

    const ruleProps = (rule.constructor as any).properties;
    if (ruleProps) {
      for (const [key, values] of Object.entries(ruleProps)) {
        if (!this._properties[key]) this._properties[key] = [];
        extendSafe(this._properties[key] as any[], values as any[]);
      }
    }
  }

  get properties(): Record<string, unknown[]> {
    return this._properties;
  }
}

export class Introspection extends Description {
  patterns: PatternDescription[];
  rules: RuleDescription[];

  constructor(rebulk: any, context?: Record<string, unknown>) {
    super();
    const effectivePatterns = rebulk.effectivePatterns(context) as BasePattern[];
    this.patterns = effectivePatterns
      .filter((p: any) => !p.private_ && !p.marker)
      .map((p: BasePattern) => new PatternDescription(p));

    const effectiveRules = rebulk.effectiveRules(context);
    this.rules = [];
    for (const rule of effectiveRules) {
      this.rules.push(new RuleDescription(rule));
    }
  }

  get properties(): Record<string, unknown[]> {
    const props: Record<string, unknown[]> = {};
    for (const pattern of this.patterns) {
      for (const [key, values] of Object.entries(pattern.properties)) {
        if (!props[key]) props[key] = [];
        extendSafe(props[key] as any[], values as any[]);
      }
    }
    for (const rule of this.rules) {
      for (const [key, values] of Object.entries(rule.properties)) {
        if (!props[key]) props[key] = [];
        extendSafe(props[key] as any[], values as any[]);
      }
    }
    return props;
  }
}

export function introspect(rebulk: any, context?: Record<string, unknown>): Introspection {
  return new Introspection(rebulk, context);
}
