/**
 * Match, Matches, Markers tests — port of rebulk/test/test_match.py
 */
import { describe, it, expect } from 'vitest';
import { Match, Matches } from '../src/match.js';
import { StringPattern, RePattern } from '../src/pattern.js';
import { formatters } from '../src/formatters.js';

describe('TestMatchClass', () => {
  it('test_repr', () => {
    const match1 = new Match(1, 3, { value: 'es' });
    expect(match1.toString()).toBe('<es:[1,3]>');

    const match2 = new Match(0, 4, { value: 'test', private: true, name: 'abc', tags: ['one', 'two'] });
    expect(match2.toString()).toContain('+private');
    expect(match2.toString()).toContain('+name=abc');
    expect(match2.toString()).toContain('one');
    expect(match2.toString()).toContain('two');
  });

  it('test_names', () => {
    const parent = new Match(0, 10, { name: 'test' });
    parent.children.append(new Match(0, 10, { name: 'child1', parent }));
    parent.children.append(new Match(0, 10, { name: 'child2', parent }));

    expect(parent.names).toEqual(new Set(['child1', 'child2']));
  });

  it('test_equality', () => {
    const match1 = new Match(1, 3, { value: 'es' });
    const match2 = new Match(1, 3, { value: 'es' });

    expect(match1.equals(match2)).toBe(true);
  });

  it('test_inequality', () => {
    const match1 = new Match(0, 2, { value: 'te' });
    const match2 = new Match(2, 4, { value: 'st' });
    const match3 = new Match(0, 2, { value: 'other' });

    expect(match1.equals(match2)).toBe(false);
    expect(match1.equals(match3)).toBe(false);
  });

  it('test_length', () => {
    const match1 = new Match(0, 4, { value: 'test' });
    const match2 = new Match(0, 2, { value: 'spanIsUsed' });

    expect(match1.length).toBe(4);
    expect(match2.length).toBe(2);
  });

  it('test_compare', () => {
    const match1 = new Match(0, 2, { value: 'te' });
    const match2 = new Match(2, 4, { value: 'st' });

    expect(match1.start < match2.start).toBe(true);
    expect(match2.start > match1.start).toBe(true);
  });

  it('test_value', () => {
    const match1 = new Match(1, 3);
    match1.value = 'test';
    expect(match1.value).toBe('test');
  });
});

describe('TestMatchesClass', () => {
  const match1 = new Match(0, 2, { value: 'te', name: 'start' });
  const match2 = new Match(2, 3, { value: 's', tags: 'tag1' as any });
  const match3 = new Match(3, 4, { value: 't', tags: ['tag1', 'tag2'] });
  const match4 = new Match(2, 4, { value: 'st', name: 'end' });

  it('test_tag', () => {
    const matches = new Matches();
    matches.append(match1);
    matches.append(match2);
    matches.append(match3);
    matches.append(match4);

    expect(matches.names.has('start')).toBe(true);
    expect(matches.names.has('end')).toBe(true);

    expect(matches.allTags.has('tag1')).toBe(true);
    expect(matches.allTags.has('tag2')).toBe(true);

    expect(match3.tagged('tag1')).toBe(true);
    expect(match3.tagged('start')).toBe(false);

    const tag1 = matches.tagged('tag1') as Match[];
    expect(tag1.length).toBe(2);
    expect(tag1[0]).toBe(match2);
    expect(tag1[1]).toBe(match3);

    const tag2 = matches.tagged('tag2') as Match[];
    expect(tag2.length).toBe(1);
    expect(tag2[0]).toBe(match3);

    const start = matches.named('start') as Match[];
    expect(start.length).toBe(1);
    expect(start[0]).toBe(match1);

    const end = matches.named('end') as Match[];
    expect(end.length).toBe(1);
    expect(end[0]).toBe(match4);
  });

  it('test_base', () => {
    const matches = new Matches();
    matches.append(match1);

    expect(matches.length).toBe(1);
    expect((matches.starting(0) as Match[]).length).toBe(1);
    expect((matches.ending(2) as Match[]).length).toBe(1);

    matches.append(match2);
    matches.append(match3);
    matches.append(match4);

    expect(matches.length).toBe(4);
    const starting2 = matches.starting(2) as Match[];
    expect(starting2).toEqual(expect.arrayContaining([match2, match4]));
    expect(starting2.length).toBe(2);

    expect((matches.starting(3) as Match[]).length).toBe(1);
    expect((matches.ending(3) as Match[]).length).toBe(1);

    const ending4 = matches.ending(4) as Match[];
    expect(ending4.length).toBe(2);

    matches.remove(match1);
    expect(matches.length).toBe(3);
    expect((matches.starting(0) as Match[]).length).toBe(0);
    expect((matches.ending(2) as Match[]).length).toBe(0);
  });

  it('test_constructor', () => {
    const matches = new Matches([match1, match2, match3, match4]);

    expect(matches.length).toBe(4);
    expect((matches.starting(0) as Match[]).length).toBe(1);
    expect((matches.ending(2) as Match[]).length).toBe(1);
    expect((matches.starting(2) as Match[]).length).toBe(2);
    expect((matches.starting(3) as Match[]).length).toBe(1);
    expect((matches.ending(3) as Match[]).length).toBe(1);
    expect((matches.ending(4) as Match[]).length).toBe(2);
  });

  it('test_constructor_kwargs', () => {
    const matches = new Matches([match1, match2, match3, match4], 'test');

    expect(matches.length).toBe(4);
    expect(matches.inputString).toBe('test');
  });

  // Note: test_get_slices, test_remove_slices, test_set_slices, test_set_index
  // are Python-specific (Python Matches supports __getitem__, __delitem__, __setitem__).
  // JS Matches doesn't have array-like slice/index assignment. These are documented
  // as intentional API differences — JS uses .get()/.at()/.remove()/.append() instead.

  it('test_crop', () => {
    const inputString = 'abcdefghijklmnopqrstuvwxyz';

    const m1 = new Match(1, 10, { inputString });
    const m2 = new Match(0, 2, { inputString });
    const m3 = new Match(8, 15, { inputString });

    let ret = m1.crop([m2, m3.span]) as Match[];
    expect(ret.length).toBe(1);
    expect(ret[0].span).toEqual([2, 8]);
    expect(ret[0].value).toBe('cdefgh');

    ret = m1.crop([1, 10]) as Match[];
    expect(ret.length).toBe(0);

    ret = m1.crop([1, 3]) as Match[];
    expect(ret.length).toBe(1);
    expect(ret[0].span).toEqual([3, 10]);

    ret = m1.crop([7, 10]) as Match[];
    expect(ret.length).toBe(1);
    expect(ret[0].span).toEqual([1, 7]);

    ret = m1.crop([0, 12]) as Match[];
    expect(ret.length).toBe(0);

    ret = m1.crop([4, 6]) as Match[];
    expect(ret.length).toBe(2);
    expect(ret[0].span).toEqual([1, 4]);
    expect(ret[1].span).toEqual([6, 10]);

    ret = m1.crop([[3, 5], [7, 9]]) as Match[];
    expect(ret.length).toBe(3);
    expect(ret[0].span).toEqual([1, 3]);
    expect(ret[1].span).toEqual([5, 7]);
    expect(ret[2].span).toEqual([9, 10]);
  });

  it('test_split', () => {
    const inputString = '123 +word1  -  word2  + word3  456';
    const match = new Match(3, inputString.length - 3, { inputString });
    const splitted = match.split(' -+') as Match[];

    expect(splitted.length).toBe(3);
    expect(splitted.map(s => s.value)).toEqual(['word1', 'word2', 'word3']);
  });
});

describe('TestMatches', () => {
  it('test_names', () => {
    const inputString = 'One Two Three';
    const matches = new Matches();

    matches.extend(new StringPattern({ name: '1-str', tags: ['One', 'str'] }, 'One').matches(inputString) as Match[]);
    matches.extend(new RePattern({ name: '1-re', tags: ['One', 're'] }, 'One').matches(inputString) as Match[]);
    matches.extend(new StringPattern({ name: '2-str', tags: ['Two', 'str'] }, 'Two').matches(inputString) as Match[]);
    matches.extend(new RePattern({ name: '2-re', tags: ['Two', 're'] }, 'Two').matches(inputString) as Match[]);
    matches.extend(new StringPattern({ name: '3-str', tags: ['Three', 'str'] }, 'Three').matches(inputString) as Match[]);
    matches.extend(new RePattern({ name: '3-re', tags: ['Three', 're'] }, 'Three').matches(inputString) as Match[]);

    expect(matches.names).toEqual(new Set(['1-str', '1-re', '2-str', '2-re', '3-str', '3-re']));
  });

  it('test_filters', () => {
    const inputString = 'One Two Three';
    const matches = new Matches();

    matches.extend(new StringPattern({ name: '1-str', tags: ['One', 'str'] }, 'One').matches(inputString) as Match[]);
    matches.extend(new RePattern({ name: '1-re', tags: ['One', 're'] }, 'One').matches(inputString) as Match[]);
    matches.extend(new StringPattern({ name: '2-str', tags: ['Two', 'str'] }, 'Two').matches(inputString) as Match[]);
    matches.extend(new RePattern({ name: '2-re', tags: ['Two', 're'] }, 'Two').matches(inputString) as Match[]);
    matches.extend(new StringPattern({ name: '3-str', tags: ['Three', 'str'] }, 'Three').matches(inputString) as Match[]);
    matches.extend(new RePattern({ name: '3-re', tags: ['Three', 're'] }, 'Three').matches(inputString) as Match[]);

    let selection = matches.starting(0) as Match[];
    expect(selection.length).toBe(2);

    selection = matches.starting(0, (m: Match) => m.tags.includes('str')) as Match[];
    expect(selection.length).toBe(1);

    selection = matches.ending(7, (m: Match) => m.tags.includes('str')) as Match[];
    expect(selection.length).toBe(1);

    const twoStr = (matches.named('2-str') as Match[])[0];
    selection = matches.previous(twoStr) as Match[];
    expect(selection.length).toBe(2);

    selection = matches.previous(twoStr, (m: Match) => m.tags.includes('str')) as Match[];
    expect(selection.length).toBe(1);

    selection = matches.next(twoStr) as Match[];
    expect(selection.length).toBe(2);

    selection = matches.next(twoStr, (m: Match) => m.tags.includes('re')) as Match[];
    expect(selection.length).toBe(1);

    // Named with predicate that excludes
    selection = matches.named('2-str', (m: Match) => m.tags.includes('re')) as Match[];
    expect(selection.length).toBe(0);

    // Named with predicate + index
    const single = matches.named('2-re', (m: Match) => m.tags.includes('re'), 0) as Match;
    expect(single).toBeDefined();
    expect(single.name).toBe('2-re');

    // index out of range
    const none = matches.named('2-re', (m: Match) => m.tags.includes('re'), 1000);
    expect(none).toBeUndefined();
  });

  it('test_raw', () => {
    const inputString = '0123456789';

    const match = new Match(0, 10, { inputString, formatter: (s: string) => s + s });

    expect(match.value).toBe(inputString + inputString);
    expect(match.raw).toBe(inputString);

    match.rawEnd = 9;
    match.rawStart = 1;

    expect(match.raw).toBe(inputString.slice(1, 9));
  });

  it('test_formatter_chain', () => {
    const inputString = '100';

    const match = new Match(0, 3, {
      inputString,
      formatter: formatters(
        (s: string) => parseInt(s, 10),
        (s: any) => s * 2,
        (s: any) => s + 10,
      ),
    });

    expect(match.raw).toBe(inputString);
    expect(match.value).toBe(100 * 2 + 10);
  });

  it('test_to_dict', () => {
    const inputString = 'One Two Two Three';
    const matches = new Matches();

    matches.extend(new StringPattern({ name: '1', tags: ['One', 'str'] }, 'One').matches(inputString) as Match[]);
    matches.extend(new RePattern({ name: '1', tags: ['One', 're'] }, 'One').matches(inputString) as Match[]);
    matches.extend(new StringPattern({ name: '2', tags: ['Two', 'str'] }, 'Two').matches(inputString) as Match[]);
    matches.extend(new RePattern({ name: '2', tags: ['Two', 're'] }, 'Two').matches(inputString) as Match[]);
    matches.extend(new RePattern({ name: '2', tags: ['Two', 'reBis'] }, 'Two').matches(inputString) as Match[]);
    matches.extend(new StringPattern({ name: '3', tags: ['Three', 'str'] }, 'Three').matches(inputString) as Match[]);
    matches.extend(new RePattern({ name: '3bis', tags: ['Three', 're'] }, 'Three').matches(inputString) as Match[]);
    matches.extend(new RePattern({ name: 'words' }, '\\w+').matches(inputString) as Match[]);

    const kvalues = matches.toDict(false, true);
    expect(kvalues.get('1')).toBe('One');
    expect(kvalues.get('2')).toBe('Two');
    expect(kvalues.get('3')).toBe('Three');
    expect(kvalues.get('3bis')).toBe('Three');
    expect(kvalues.get('words')).toBe('One');
    expect(kvalues.valuesList.get('words')).toEqual(['One', 'Two', 'Three']);

    const enforced = matches.toDict(false, false, true);
    expect(enforced.get('words')).toEqual(['One', 'Two', 'Three']);

    const detailed = matches.toDict(true);
    // In details mode, "1" has two matches from StringPattern and RePattern (both value "One")
    const d1 = detailed.get('1');
    if (Array.isArray(d1)) {
      expect(d1[0].value).toBe('One');
    } else {
      expect((d1 as Match).value).toBe('One');
    }

    const d2 = detailed.get('2');
    expect(Array.isArray(d2)).toBe(true);

    const d3 = detailed.get('3');
    if (Array.isArray(d3)) {
      expect(d3[0].value).toBe('Three');
    } else {
      expect((d3 as Match).value).toBe('Three');
    }
    expect((Array.isArray(detailed.get('3bis')) ? (detailed.get('3bis') as Match[])[0] : detailed.get('3bis') as Match).value).toBe('Three');

    const words = detailed.get('words');
    expect(Array.isArray(words)).toBe(true);
    expect((words as Match[]).length).toBeGreaterThanOrEqual(4);
  });

  it('test_chains', () => {
    const inputString = 'wordX 10 20 30 40 wordA, wordB, wordC 70 80 wordX';
    const matches = new Matches(undefined, inputString);

    matches.extend(new RePattern({ name: 'digit' }, '\\d+').matches(inputString) as Match[]);
    matches.extend(new RePattern({ name: 'word' }, '[a-zA-Z]+').matches(inputString) as Match[]);

    expect(matches.length).toBe(11);

    const bStart = inputString.indexOf('wordB');
    const bEnd = bStart + 'wordB'.length;
    const aStart = inputString.indexOf('wordA');
    const cEnd = inputString.indexOf('wordC') + 'wordC'.length;

    let chainBefore = matches.chainBefore(bStart, ' ,', 0, (m: Match) => m.name === 'word') as Match[];
    expect(chainBefore.length).toBe(1);
    expect(chainBefore[0].value).toBe('wordA');

    chainBefore = matches.chainBefore(bStart, ' ,', 0, (m: Match) => m.name === 'digit') as Match[];
    expect(chainBefore.length).toBe(0);

    chainBefore = matches.chainBefore(aStart, ' ,', 0, (m: Match) => m.name === 'digit') as Match[];
    expect(chainBefore.length).toBe(4);
    expect(chainBefore.map(m => m.value)).toEqual(['40', '30', '20', '10']);

    let chainAfter = matches.chainAfter(bEnd, ' ,', undefined, (m: Match) => m.name === 'word') as Match[];
    expect(chainAfter.length).toBe(1);
    expect(chainAfter[0].value).toBe('wordC');

    chainAfter = matches.chainAfter(bEnd, ' ,', undefined, (m: Match) => m.name === 'digit') as Match[];
    expect(chainAfter.length).toBe(0);

    chainAfter = matches.chainAfter(cEnd, ' ,', undefined, (m: Match) => m.name === 'digit') as Match[];
    expect(chainAfter.length).toBe(2);
    expect(chainAfter.map(m => m.value)).toEqual(['70', '80']);
  });

  it('test_holes', () => {
    const inputString = '1'.repeat(10) + '2'.repeat(10) + '3'.repeat(10) + '4'.repeat(10) + '5'.repeat(10) + '6'.repeat(10) + '7'.repeat(10);

    const hole1 = new Match(0, 10, { inputString });
    const hole2 = new Match(20, 30, { inputString });
    const hole3 = new Match(30, 40, { inputString });
    const hole4 = new Match(60, 70, { inputString });

    const matches = new Matches([hole1, hole2], inputString);
    matches.append(hole3);
    matches.append(hole4);

    let holes = matches.holes() as Match[];
    expect(holes.length).toBe(2);
    expect(holes[0].span).toEqual([10, 20]);
    expect(holes[0].value).toBe('2'.repeat(10));
    expect(holes[1].span).toEqual([40, 60]);
    expect(holes[1].value).toBe('5'.repeat(10) + '6'.repeat(10));

    holes = matches.holes(5, 15) as Match[];
    expect(holes.length).toBe(1);
    expect(holes[0].span).toEqual([10, 15]);
    expect(holes[0].value).toBe('2'.repeat(5));

    holes = matches.holes(5, 15, { formatter: (_v: string) => 'formatted' }) as Match[];
    expect(holes.length).toBe(1);
    expect(holes[0].value).toBe('formatted');

    holes = matches.holes(5, 15, { predicate: () => false }) as Match[];
    expect(holes.length).toBe(0);
  });

  it('test_holes_empty', () => {
    const inputString = 'Test hole on empty matches';
    const matches = new Matches(undefined, inputString);
    const holes = matches.holes() as Match[];
    expect(holes.length).toBe(1);
    expect(holes[0].value).toBe(inputString);
  });

  it('test_holes_seps', () => {
    const inputString = 'Test hole - with many separators + included';
    const match = new StringPattern({}, 'many').matches(inputString) as Match[];

    const matches = new Matches(match, inputString);
    let holes = matches.holes() as Match[];
    expect(holes.length).toBe(2);

    holes = matches.holes(0, undefined, { seps: '-+' }) as Match[];
    expect(holes.length).toBe(4);
    expect(holes.map(h => h.value)).toEqual(['Test hole ', ' with ', ' separators ', ' included']);
  });
});
