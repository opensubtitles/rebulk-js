/**
 * Introspector tests — port of rebulk/test/test_introspector.py
 */
import { describe, it, expect } from 'vitest';
import { Rebulk, Rule, AppendMatch, Match } from '../src/rebulk.js';
import { introspect } from '../src/introspector.js';

// Rule classes with properties (matching Python default_rules_module.py)
class RuleAppend2 extends Rule {
  consequence = [new AppendMatch('renamed')];
  static override properties = { renamed: [null] };
  when() { return [new Match(5, 10)]; }
}

class RuleAppend3 extends Rule {
  consequence = new AppendMatch('renamed');
  static override properties = { renamed: [null] };
  when() { return [new Match(5, 10)]; }
}

describe('Introspector', () => {
  it('test_string_introspector', () => {
    const rebulk = new Rebulk()
      .string('One', 'Two', 'Three', { name: 'first' })
      .string('1', '2', '3', { name: 'second' });

    const introspected = introspect(rebulk, undefined);

    expect(introspected.patterns.length).toBe(2);

    const firstProperties = introspected.patterns[0].properties;
    expect(Object.keys(firstProperties).length).toBe(1);
    expect(firstProperties['first']).toEqual(['One', 'Two', 'Three']);

    const secondProperties = introspected.patterns[1].properties;
    expect(Object.keys(secondProperties).length).toBe(1);
    expect(secondProperties['second']).toEqual(['1', '2', '3']);

    const properties = introspected.properties;
    expect(Object.keys(properties).length).toBe(2);
    expect(properties['first']).toEqual(firstProperties['first']);
    expect(properties['second']).toEqual(secondProperties['second']);
  });

  it('test_string_properties', () => {
    const rebulk = new Rebulk()
      .string('One', 'Two', 'Three', { name: 'first', properties: { custom: ['One'] } })
      .string('1', '2', '3', { name: 'second', properties: { custom: [1] } });

    const introspected = introspect(rebulk, undefined);

    expect(introspected.patterns.length).toBe(2);
    // Default rules (ConflictSolver, PrivateRemover) count as rules
    expect(introspected.rules.length).toBe(2);

    const firstProperties = introspected.patterns[0].properties;
    expect(Object.keys(firstProperties).length).toBe(1);
    expect(firstProperties['custom']).toEqual(['One']);

    const secondProperties = introspected.patterns[1].properties;
    expect(Object.keys(secondProperties).length).toBe(1);
    expect(secondProperties['custom']).toEqual([1]);

    const properties = introspected.properties;
    expect(Object.keys(properties).length).toBe(1);
    expect(properties['custom']).toEqual(['One', 1]);
  });

  it('test_various_pattern', () => {
    const rebulk = new Rebulk()
      .regex('One', 'Two', 'Three', { name: 'first', value: 'string' })
      .string('1', '2', '3', { name: 'second', value: 'digit' })
      .string('4', '5', '6', { name: 'third' })
      .string('private', { private: true })
      .functional((s: string) => {
        return [0, 5] as [number, number];
      }, { name: 'func', value: 'test' })
      .regex('One', 'Two', 'Three', { name: 'regex_name' })
      .regex('(?<one>One)(?<two>Two)(?<three>Three)')
      .functional((s: string) => {
        return [6, 10] as [number, number];
      }, { name: 'func2' })
      .string('7', { name: 'third' });

    const introspected = introspect(rebulk, undefined);

    // Private pattern is excluded
    expect(introspected.patterns.length).toBe(8);
    expect(introspected.rules.length).toBe(2);

    // First pattern: regex with value override
    const firstProps = introspected.patterns[0].properties;
    expect(Object.keys(firstProps).length).toBe(1);
    expect(firstProps['first']).toEqual(['string']);

    // Second: string with value override
    const secondProps = introspected.patterns[1].properties;
    expect(Object.keys(secondProps).length).toBe(1);
    expect(secondProps['second']).toEqual(['digit']);

    // Third: string without value → patterns are the values
    const thirdProps = introspected.patterns[2].properties;
    expect(Object.keys(thirdProps).length).toBe(1);
    expect(thirdProps['third']).toEqual(['4', '5', '6']);

    // Functional with value
    const funcProps = introspected.patterns[3].properties;
    expect(Object.keys(funcProps).length).toBe(1);
    expect(funcProps['func']).toEqual(['test']);

    // Regex with name but no value → [null]
    const regexNameProps = introspected.patterns[4].properties;
    expect(Object.keys(regexNameProps).length).toBe(1);
    expect(regexNameProps['regex_name']).toEqual([null]);

    // Regex with named groups → each group is [null]
    const regexGroupsProps = introspected.patterns[5].properties;
    expect(Object.keys(regexGroupsProps).length).toBe(3);
    expect(regexGroupsProps['one']).toEqual([null]);
    expect(regexGroupsProps['two']).toEqual([null]);
    expect(regexGroupsProps['three']).toEqual([null]);

    // Functional without value → [null]
    const func2Props = introspected.patterns[6].properties;
    expect(Object.keys(func2Props).length).toBe(1);
    expect(func2Props['func2']).toEqual([null]);

    // String '7' with name third
    const appendThirdProps = introspected.patterns[7].properties;
    expect(Object.keys(appendThirdProps).length).toBe(1);
    expect(appendThirdProps['third']).toEqual(['7']);

    // Merged properties
    const properties = introspected.properties;
    expect(Object.keys(properties).length).toBe(9);
    expect(properties['first']).toEqual(firstProps['first']);
    expect(properties['second']).toEqual(secondProps['second']);
    expect(properties['third']).toEqual([...thirdProps['third'], ...appendThirdProps['third']]);
    expect(properties['func']).toEqual(funcProps['func']);
    expect(properties['regex_name']).toEqual(regexNameProps['regex_name']);
    expect(properties['one']).toEqual(regexGroupsProps['one']);
    expect(properties['two']).toEqual(regexGroupsProps['two']);
    expect(properties['three']).toEqual(regexGroupsProps['three']);
    expect(properties['func2']).toEqual(func2Props['func2']);
  });

  it('test_rule_properties', () => {
    const rebulk = new Rebulk({ defaultRules: false });
    rebulk.rules(RuleAppend2, RuleAppend3);

    const introspected = introspect(rebulk, undefined);

    expect(introspected.rules.length).toBe(2);
    expect(introspected.patterns.length).toBe(0);

    const ruleProps0 = introspected.rules[0].properties;
    expect(Object.keys(ruleProps0).length).toBe(1);
    expect(ruleProps0['renamed']).toEqual([null]);

    const ruleProps1 = introspected.rules[1].properties;
    expect(Object.keys(ruleProps1).length).toBe(1);
    expect(ruleProps1['renamed']).toEqual([null]);

    const properties = introspected.properties;
    expect(Object.keys(properties).length).toBe(1);
    expect(properties['renamed']).toEqual([null]);
  });
});
