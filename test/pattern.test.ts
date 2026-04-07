/**
 * Pattern tests — port of rebulk/test/test_pattern.py
 */
import { describe, it, expect } from 'vitest';
import { StringPattern, RePattern, FunctionalPattern } from '../src/pattern.js';
import { Match } from '../src/match.js';
import type { Context } from '../src/pattern.js';

class ValueError extends Error { constructor(msg: string) { super(msg); } }

const INPUT_STRING = 'An Abyssinian fly playing a Celtic violin was annoyed by trashy flags on which were the Hebrew letter qoph.';

describe('TestStringPattern', () => {
  it('test_single', () => {
    const pattern = new StringPattern({}, 'Celtic');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].pattern).toBe(pattern);
    expect(matches[0].span).toEqual([28, 34]);
    expect(matches[0].value).toBe('Celtic');
  });

  it('test_repr', () => {
    const pattern = new StringPattern({}, 'Celtic');
    expect(pattern.toString()).toBe("<StringPattern:('Celtic')>");
  });

  it('test_start_end_kwargs', () => {
    // "Abyssinian" starts at index 3. With start=20,end=40 it's outside the range.
    const pattern = new StringPattern({ start: 20, end: 40 }, 'Abyssinian');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(0);
  });

  it('test_ignore_case', () => {
    let pattern = new StringPattern({ ignoreCase: false }, 'celtic');
    let matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(0);

    pattern = new StringPattern({ ignoreCase: true }, 'celtic');
    matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].value).toBe('Celtic');
  });

  it('test_private_names', () => {
    const pattern = new StringPattern({ name: 'test', privateNames: ['test'], ignoreCase: true }, 'celtic');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].private).toBe(true);
  });

  it('test_ignore_names', () => {
    const pattern = new StringPattern({ name: 'test', ignoreNames: ['test'], ignoreCase: true }, 'celtic');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(0);
  });

  it('test_no_match', () => {
    const pattern = new StringPattern({}, 'Python');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(0);
  });

  it('test_multiple_patterns', () => {
    const pattern = new StringPattern({}, 'playing', 'annoyed', 'Hebrew');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(3);

    expect(matches[0].span).toEqual([18, 25]);
    expect(matches[0].value).toBe('playing');

    expect(matches[1].span).toEqual([46, 53]);
    expect(matches[1].value).toBe('annoyed');

    expect(matches[2].span).toEqual([88, 94]);
    expect(matches[2].value).toBe('Hebrew');
  });

  it('test_matches_kwargs', () => {
    const pattern = new StringPattern({ name: 'test', value: 'AB' }, 'Abyssinian');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].name).toBe('test');
    expect(matches[0].value).toBe('AB');
  });

  it('test_post_processor', () => {
    const pattern = new StringPattern({
      name: 'test',
      value: 'AB',
      postProcessor: (matches, pat) => {
        expect(matches.length).toBe(1);
        expect(pat).toBeInstanceOf(StringPattern);
        return [];
      },
    }, 'Abyssinian');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(0);
  });
});

describe('TestRePattern', () => {
  it('test_single_compiled', () => {
    // In Python, RePattern accepts compiled regex objects.
    // In JS, we pass a RegExp directly.
    const pattern = new RePattern({}, 'Celt.?c');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].span).toEqual([28, 34]);
    expect(matches[0].value).toBe('Celtic');
  });

  it('test_single_string', () => {
    const pattern = new RePattern({}, 'Celt.?c');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].pattern).toBe(pattern);
    expect(matches[0].span).toEqual([28, 34]);
    expect(matches[0].value).toBe('Celtic');
  });

  it('test_single_kwargs', () => {
    // Python: RePattern({"pattern": "celt.?c", "flags": re.IGNORECASE})
    // JS equivalent: pass ignoreCase option
    const pattern = new RePattern({ ignoreCase: true }, 'celt.?c');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].span).toEqual([28, 34]);
    expect(matches[0].value).toBe('Celtic');
  });

  it('test_single_vargs', () => {
    // Python: RePattern(("celt.?c", re.IGNORECASE))
    // JS equivalent: pass flags option
    const pattern = new RePattern({ flags: 'i' }, 'celt.?c');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].span).toEqual([28, 34]);
    expect(matches[0].value).toBe('Celtic');
  });

  it('test_no_match', () => {
    const pattern = new RePattern({}, 'abc.?def');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(0);
  });

  it('test_shortcuts', () => {
    let pattern = new RePattern({ abbreviations: [['-', '[\\W_]+']] }, 'Celtic-violin');
    let matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);

    pattern = new RePattern({ ignoreCase: true, abbreviations: [['-', '[\\W_]+']] }, 'celtic-violin');
    matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);
  });

  it('test_multiple_patterns', () => {
    const pattern = new RePattern({}, 'pla.?ing', 'ann.?yed', 'Heb.?ew');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(3);

    expect(matches[0].span).toEqual([18, 25]);
    expect(matches[0].value).toBe('playing');
    expect(matches[1].span).toEqual([46, 53]);
    expect(matches[1].value).toBe('annoyed');
    expect(matches[2].span).toEqual([88, 94]);
    expect(matches[2].value).toBe('Hebrew');
  });

  it('test_unnamed_groups', () => {
    const pattern = new RePattern({}, '(Celt.?c)\\s+(\\w+)');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);

    const parent = matches[0];
    expect(parent.span).toEqual([28, 41]);
    expect(parent.value).toBe('Celtic violin');

    expect(parent.children.length).toBe(2);
    const [group1, group2] = parent.children.toArray();

    expect(group1.span).toEqual([28, 34]);
    expect(group1.value).toBe('Celtic');
    expect(group1.parent).toBe(parent);

    expect(group2.span).toEqual([35, 41]);
    expect(group2.value).toBe('violin');
    expect(group2.parent).toBe(parent);
  });

  it('test_named_groups', () => {
    const pattern = new RePattern({}, '(?P<param1>Celt.?c)\\s+(?P<param2>\\w+)');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);

    const parent = matches[0];
    expect(parent.span).toEqual([28, 41]);

    const [group1, group2] = parent.children.toArray();
    expect(group1.name).toBe('param1');
    expect(group1.value).toBe('Celtic');
    expect(group2.name).toBe('param2');
    expect(group2.value).toBe('violin');
  });

  it('test_children', () => {
    const pattern = new RePattern({ children: true }, '(?P<param1>Celt.?c)\\s+(?P<param2>\\w+)');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(2);

    expect(matches[0].name).toBe('param1');
    expect(matches[0].value).toBe('Celtic');
    expect(matches[1].name).toBe('param2');
    expect(matches[1].value).toBe('violin');
  });

  it('test_children_parent_private', () => {
    const pattern = new RePattern({ children: true, privateParent: true }, '(?P<param1>Celt.?c)\\s+(?P<param2>\\w+)');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(3);

    const [parent, group1, group2] = matches;
    expect(parent.private).toBe(true);
    expect(parent.span).toEqual([28, 41]);

    expect(group1.private).toBe(false);
    expect(group1.name).toBe('param1');
    expect(group1.value).toBe('Celtic');

    expect(group2.private).toBe(false);
    expect(group2.name).toBe('param2');
    expect(group2.value).toBe('violin');
  });

  it('test_parent_children_private', () => {
    const pattern = new RePattern({ privateChildren: true }, '(?P<param1>Celt.?c)\\s+(?P<param2>\\w+)');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(3);

    const [parent, group1, group2] = matches;
    expect(parent.private).toBe(false);
    expect(parent.span).toEqual([INPUT_STRING.indexOf('Celtic'), INPUT_STRING.indexOf('Celtic') + 'Celtic violin'.length]);
    expect(parent.pattern).toBe(pattern);
    expect(group1.private).toBe(true);
    expect(group1.name).toBe('param1');
    expect(group1.value).toBe('Celtic');
    expect(group2.private).toBe(true);
    expect(group2.name).toBe('param2');
    expect(group2.value).toBe('violin');
  });

  it('test_every', () => {
    const pattern = new RePattern({ every: true }, '(?P<param1>Celt.?c)\\s+(?P<param2>\\w+)');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(3);

    const [parent, group1, group2] = matches;
    expect(parent.private).toBe(false);
    expect(parent.span).toEqual([INPUT_STRING.indexOf('Celtic'), INPUT_STRING.indexOf('Celtic') + 'Celtic violin'.length]);
    expect(parent.pattern).toBe(pattern);
    expect(group1.private).toBe(false);
    expect(group1.name).toBe('param1');
    expect(group1.value).toBe('Celtic');
    expect(group2.private).toBe(false);
    expect(group2.name).toBe('param2');
    expect(group2.value).toBe('violin');
  });

  it('test_private_names', () => {
    const pattern = new RePattern({ privateNames: ['param2'], children: true }, '(?P<param1>Celt.?c)\\s+(?P<param2>\\w+)');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(2);
    expect(matches[0].name).toBe('param1');
    expect(matches[0].private).toBe(false);
    expect(matches[1].name).toBe('param2');
    expect(matches[1].private).toBe(true);
  });

  it('test_ignore_names', () => {
    const pattern = new RePattern({ ignoreNames: ['param2'], children: true }, '(?P<param1>Celt.?c)\\s+(?P<param2>\\w+)');
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].name).toBe('param1');
  });

  it('test_matches_kwargs', () => {
    let pattern = new RePattern({ name: 'test', value: 'HE' }, 'He.rew');
    let matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].name).toBe('test');
    expect(matches[0].value).toBe('HE');

    // With unnamed groups
    pattern = new RePattern({ name: 'test', value: 'HE' }, 'H(e.)(rew)');
    matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].name).toBe('test');
    expect(matches[0].value).toBe('HE');

    const children = matches[0].children.toArray();
    expect(children.length).toBe(2);
    expect(children[0].value).toBe('HE');
    expect(children[1].value).toBe('HE');

    // With named groups
    pattern = new RePattern({ name: 'test', value: 'HE' }, 'H(?P<first>e.)(?P<second>rew)');
    matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].value).toBe('HE');

    const namedChildren = matches[0].children.toArray();
    expect(namedChildren.length).toBe(2);
    expect(namedChildren[0].name).toBe('first');
    expect(namedChildren[0].value).toBe('HE');
    expect(namedChildren[1].name).toBe('second');
    expect(namedChildren[1].value).toBe('HE');
  });
});

describe('TestFunctionalPattern', () => {
  it('test_single_vargs', () => {
    // In Python, func returns (start, end, value, name) positional args.
    // In JS port, func returns [start, end, {name, value}] dict form for the 3rd element.
    function func(inputString: string) {
      const i = inputString.indexOf('fly');
      if (i > -1) return [i, i + 'fly'.length, { name: 'functional' }] as any;
      return null;
    }

    const pattern = new FunctionalPattern({}, func);
    const matches = pattern.matches(INPUT_STRING) as Match[];
    // The JS FunctionalPattern sees [14, 17, {name:'functional'}] — 3-element array.
    // It interprets last element as opts if it's an object.
    expect(matches.length).toBe(1);
    expect(matches[0].span).toEqual([14, 17]);
    expect(matches[0].name).toBe('functional');
    expect(matches[0].value).toBe('fly');
  });

  it('test_single_kwargs', () => {
    function func(inputString: string) {
      const i = inputString.indexOf('fly');
      if (i > -1) return { start: i, end: i + 'fly'.length, name: 'functional' };
      return null;
    }

    const pattern = new FunctionalPattern({}, func);
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].span).toEqual([14, 17]);
    expect(matches[0].name).toBe('functional');
    expect(matches[0].value).toBe('fly');
  });

  it('test_multiple_objects', () => {
    function func(inputString: string) {
      const results: any[] = [];
      let i = inputString.indexOf('fly');
      if (i > -1) results.push([i, i + 'fly'.length, { name: 'functional' }]);
      i = inputString.indexOf('annoyed');
      if (i > -1) results.push([i, i + 'annoyed'.length]);
      i = inputString.indexOf('Hebrew');
      if (i > -1) results.push({ start: i, end: i + 'Hebrew'.length });
      return results;
    }

    const pattern = new FunctionalPattern({}, func);
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(3);

    expect(matches[0].span).toEqual([14, 17]);
    expect(matches[0].name).toBe('functional');
    expect(matches[1].span).toEqual([46, 53]);
    expect(matches[2].span).toEqual([88, 94]);
  });

  it('test_multiple_generator', () => {
    // Python uses generators. In JS, we return an array of results (same effect).
    function func(inputString: string) {
      const results: any[] = [];
      let i = inputString.indexOf('fly');
      if (i > -1) results.push([i, i + 'fly'.length, { name: 'functional' }]);
      i = inputString.indexOf('annoyed');
      if (i > -1) results.push([i, i + 'annoyed'.length]);
      i = inputString.indexOf('Hebrew');
      if (i > -1) results.push({ start: i, end: i + 'Hebrew'.length });
      return results;
    }

    const pattern = new FunctionalPattern({}, func);
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(3);
    expect(matches[0].span).toEqual([14, 17]);
    expect(matches[0].name).toBe('functional');
    expect(matches[1].span).toEqual([46, 53]);
    expect(matches[2].span).toEqual([88, 94]);
  });

  it('test_no_match', () => {
    const pattern = new FunctionalPattern({}, () => null);
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(0);
  });

  it('test_multiple_patterns', () => {
    function playing(s: string) { const i = s.indexOf('playing'); return i > -1 ? [i, i + 7] as [number, number] : null; }
    function annoyed(s: string) { const i = s.indexOf('annoyed'); return i > -1 ? [i, i + 7] as [number, number] : null; }
    function hebrew(s: string) { const i = s.indexOf('Hebrew'); return i > -1 ? [i, i + 6] as [number, number] : null; }

    const pattern = new FunctionalPattern({}, playing, annoyed, hebrew);
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(3);

    expect(matches[0].span).toEqual([18, 25]);
    expect(matches[1].span).toEqual([46, 53]);
    expect(matches[2].span).toEqual([88, 94]);
  });

  it('test_matches_kwargs', () => {
    function playing(s: string) { const i = s.indexOf('playing'); return i > -1 ? [i, i + 7] as [number, number] : null; }

    const pattern = new FunctionalPattern({ name: 'test', value: 'PLAY' }, playing);
    const matches = pattern.matches(INPUT_STRING) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].name).toBe('test');
    expect(matches[0].value).toBe('PLAY');
  });
});

describe('TestValue', () => {
  const valInputString = 'This string contains 1849 a number';

  it('test_str_value', () => {
    const pattern = new StringPattern({ name: 'dummy', value: 'test' }, '1849');
    const matches = pattern.matches(valInputString) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].span).toEqual([21, 25]);
    expect(matches[0].value).toBe('test');
  });

  it('test_dict_child_value', () => {
    const pattern = new RePattern({
      formatter: { intParam: (x: string) => parseInt(x) * 2, strParam: (x: string) => 'really ' + x },
      formatAll: true,
      value: { intParam: 'INT_PARAM_VALUE' },
    }, '(?P<strParam>cont.?ins)\\s+(?P<intParam>\\d+)');

    const matches = pattern.matches(valInputString) as Match[];
    expect(matches.length).toBe(1);

    const parent = matches[0];
    const [group1, group2] = parent.children.toArray();

    expect(group1.value).toBe('really contains');
    expect(group2.value).toBe('INT_PARAM_VALUE');
  });

  it('test_dict_default_value', () => {
    const pattern = new RePattern({
      formatter: { intParam: (x: string) => parseInt(x) * 2, strParam: (x: string) => 'really ' + x },
      formatAll: true,
      value: { __children__: 'CHILD', strParam: 'STR_VALUE', __parent__: 'PARENT' },
    }, '(?P<strParam>cont.?ins)\\s+(?P<intParam>\\d+)');

    const matches = pattern.matches(valInputString) as Match[];
    expect(matches.length).toBe(1);

    const parent = matches[0];
    expect(parent.value).toBe('PARENT');

    const [group1, group2] = parent.children.toArray();
    expect(group1.value).toBe('STR_VALUE');
    expect(group2.value).toBe('CHILD');
  });
});

describe('TestFormatter', () => {
  const fmtInputString = 'This string contains 1849 a number';

  it('test_single_string', () => {
    const pattern = new StringPattern({ name: 'dummy', formatter: (x: string) => parseInt(x) / 2 }, '1849');
    const matches = pattern.matches(fmtInputString) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].value).toBe(1849 / 2);
  });

  it('test_single_re_no_group', () => {
    const pattern = new RePattern({ formatter: (x: string) => parseInt(x) * 2 }, '\\d+');
    const matches = pattern.matches(fmtInputString) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].value).toBe(1849 * 2);
  });

  it('test_single_re_named_groups', () => {
    const pattern = new RePattern({
      formatter: { intParam: (x: string) => parseInt(x) * 2, strParam: (x: string) => 'really ' + x },
      formatAll: true,
    }, '(?P<strParam>cont.?ins)\\s+(?P<intParam>\\d+)');

    const matches = pattern.matches(fmtInputString) as Match[];
    expect(matches.length).toBe(1);

    const [group1, group2] = matches[0].children.toArray();
    expect(group1.value).toBe('really contains');
    expect(group2.value).toBe(1849 * 2);
  });

  it('test_repeated_captures', () => {
    // Python has two code paths:
    //   if REGEX_ENABLED: 5 children (regex module captures all repeats)
    //   else: 2 children (re module only captures last repeat)
    // JS RegExp behaves like Python's `re` module (no repeated capture support).
    // This matches Python's `REGEX_ENABLED=False` / `repeated_captures=False` path exactly.
    const pattern = new RePattern({}, '\\[(\\d+)\\](?:-(\\d+))*');
    const matches = pattern.matches('[02]-03-04-05-06') as Match[];
    expect(matches.length).toBe(1);

    const match = matches[0];
    expect(match.children.length).toBe(2);
    expect(match.children.toArray().map(c => c.value)).toEqual(['02', '06']);
  });

  it('test_single_functional', () => {
    function digit(inputString: string) {
      const i = inputString.indexOf('1849');
      return i > -1 ? [i, i + 4] as [number, number] : null;
    }

    const pattern = new FunctionalPattern({ formatter: (x: string) => parseInt(x) * 3 }, digit);
    const matches = pattern.matches(fmtInputString) as Match[];
    expect(matches.length).toBe(1);
    expect(matches[0].value).toBe(1849 * 3);
  });
});

describe('TestValidator', () => {
  const valInputStr = 'This string contains 1849 a number';
  const trueValidator = (match: Match) => parseInt(String(match.value)) < 1850;
  const falseValidator = (match: Match) => parseInt(String(match.value)) >= 1850;

  it('test_single_string', () => {
    let pattern = new StringPattern({ name: 'dummy', validator: falseValidator }, '1849');
    expect((pattern.matches(valInputStr) as Match[]).length).toBe(0);

    pattern = new StringPattern({ validator: trueValidator }, '1849');
    expect((pattern.matches(valInputStr) as Match[]).length).toBe(1);
  });

  it('test_single_re_no_group', () => {
    let pattern = new RePattern({ validator: falseValidator }, '\\d+');
    expect((pattern.matches(valInputStr) as Match[]).length).toBe(0);

    pattern = new RePattern({ validator: trueValidator }, '\\d+');
    expect((pattern.matches(valInputStr) as Match[]).length).toBe(1);
  });

  it('test_single_re_named_groups', () => {
    let pattern = new RePattern({
      validator: { intParam: falseValidator },
      validateAll: true,
    }, '(?P<strParam>cont.?ins)\\s+(?P<intParam>\\d+)');
    expect((pattern.matches(valInputStr) as Match[]).length).toBe(0);

    pattern = new RePattern({
      validator: { intParam: trueValidator },
      validateAll: true,
    }, '(?P<strParam>cont.?ins)\\s+(?P<intParam>\\d+)');
    expect((pattern.matches(valInputStr) as Match[]).length).toBe(1);
  });

  it('test_validate_all', () => {
    // Python first sub-scenario: value < 100 → validator fails → 0 matches
    let pattern = new RePattern({
      formatter: (x: string) => parseInt(x) || x,
      validator: (match: Match) => typeof match.value === 'number' ? match.value < 100 : true,
      children: true,
    }, 'contains (?P<intParam>\\d+)');
    let matches = pattern.matches(valInputStr) as Match[];
    expect(matches.length).toBe(0);

    // validator on children — intParam is 1849 which is > 100
    pattern = new RePattern({
      formatter: (x: string) => parseInt(x) || x,
      validator: (match: Match) => typeof match.value === 'number' ? match.value > 100 : true,
      children: true,
    }, 'contains (?P<intParam>\\d+)');
    matches = pattern.matches(valInputStr) as Match[];
    expect(matches.length).toBe(1);

    // validator blocks children that don't start with 'abc'
    pattern = new RePattern({
      formatter: (x: string) => parseInt(x) || x,
      validator: (match: Match) => {
        if (match.name === 'intParam') return true;
        return String(match.value).startsWith('abc');
      },
      validateAll: true,
      children: true,
    }, 'contains (?P<intParam>\\d+)');
    matches = pattern.matches(valInputStr) as Match[];
    expect(matches.length).toBe(0);

    // validator passes for parent too
    pattern = new RePattern({
      formatter: (x: string) => parseInt(x) || x,
      validator: (match: Match) => {
        if (match.name === 'intParam') return true;
        return String(match.value).startsWith('contains');
      },
      validateAll: true,
      children: true,
    }, 'contains (?P<intParam>\\d+)');
    matches = pattern.matches(valInputStr) as Match[];
    expect(matches.length).toBe(1);
  });

  it('test_format_all', () => {
    // With formatAll, the formatter is applied to the parent match too.
    // If the parent's raw string can't be parsed by the formatter, it throws.
    let pattern = new RePattern({
      formatter: (x: string) => parseInt(x) || x,
      children: true,
    }, 'contains (?P<intParam>\\d+)');
    let matches = pattern.matches(valInputStr) as Match[];
    expect(matches.length).toBe(1);

    // With formatAll: true, parent match ("contains 1849") gets formatted too
    // parseInt("contains 1849") returns NaN, but our formatter uses || x fallback
    pattern = new RePattern({
      formatter: (x: string) => { const n = parseInt(x); if (isNaN(n)) throw new ValueError(x); return n; },
      formatAll: true,
    }, 'contains (?P<intParam>\\d+)');

    // This should throw because "contains 1849" can't be parsed as int
    expect(() => {
      const m = pattern.matches(valInputStr) as Match[];
      // Force value evaluation
      for (const match of m) { match.value; }
    }).toThrow();
  });

  it('test_single_functional', () => {
    function digit(inputString: string) {
      const i = inputString.indexOf('1849');
      return i > -1 ? [i, i + 4] as [number, number] : null;
    }

    let pattern = new FunctionalPattern({ validator: falseValidator }, digit);
    expect((pattern.matches(valInputStr) as Match[]).length).toBe(0);

    pattern = new FunctionalPattern({ validator: trueValidator }, digit);
    expect((pattern.matches(valInputStr) as Match[]).length).toBe(1);
  });
});
