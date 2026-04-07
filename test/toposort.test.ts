/**
 * Topological sort tests — port of rebulk/test/test_toposort.py
 */
import { describe, it, expect } from 'vitest';
import { toposort, toposortFlatten, CyclicDependency } from '../src/toposort.js';

describe('Toposort', () => {
  it('test_simple', () => {
    const data = new Map<number, Set<number>>([
      [2, new Set([11])],
      [9, new Set([11, 8])],
      [10, new Set([11, 3])],
      [11, new Set([7, 5])],
      [8, new Set([7, 3])],
    ]);
    const results = [...toposort(data)];
    expect(results).toEqual([new Set([3, 5, 7]), new Set([8, 11]), new Set([2, 9, 10])]);
  });

  it('self dependencies are ignored', () => {
    const data = new Map<number, Set<number>>([
      [2, new Set([2, 11])],
      [9, new Set([11, 8])],
      [10, new Set([10, 11, 3])],
      [11, new Set([7, 5])],
      [8, new Set([7, 3])],
    ]);
    const results = [...toposort(data)];
    expect(results).toEqual([new Set([3, 5, 7]), new Set([8, 11]), new Set([2, 9, 10])]);
  });

  it('single item', () => {
    expect([...toposort(new Map([[1, new Set()]]))]).toEqual([new Set([1])]);
    expect([...toposort(new Map([[1, new Set([1])]]))]).toEqual([new Set([1])]);
  });

  it('test_no_dependencies', () => {
    const data = new Map<number, Set<number>>([
      [1, new Set([2])],
      [3, new Set([4])],
      [5, new Set([6])],
    ]);
    const results = [...toposort(data)];
    expect(results).toEqual([new Set([2, 4, 6]), new Set([1, 3, 5])]);

    expect([...toposort(new Map([[1, new Set()], [3, new Set()], [5, new Set()]]))]).toEqual([new Set([1, 3, 5])]);
  });

  it('test_empty', () => {
    expect([...toposort(new Map())]).toEqual([]);
  });

  it('test_strings', () => {
    const data = new Map<string, Set<string>>([
      ['2', new Set(['11'])],
      ['9', new Set(['11', '8'])],
      ['10', new Set(['11', '3'])],
      ['11', new Set(['7', '5'])],
      ['8', new Set(['7', '3'])],
    ]);
    const results = [...toposort(data)];
    expect(results).toEqual([new Set(['3', '5', '7']), new Set(['8', '11']), new Set(['2', '9', '10'])]);
  });

  it('test_cycle - simple', () => {
    expect(() => [...toposort(new Map([[1, new Set([2])], [2, new Set([1])]]))]).toThrow(CyclicDependency);
  });

  it('test_cycle - indirect', () => {
    expect(() => [...toposort(new Map([[1, new Set([2])], [2, new Set([3])], [3, new Set([1])]]))]).toThrow(CyclicDependency);
  });

  it('test_input_not_modified', () => {
    const data = new Map<number, Set<number>>([
      [2, new Set([11])],
      [9, new Set([11, 8])],
      [10, new Set([11, 3])],
      [11, new Set([7, 5])],
      [8, new Set([7, 3, 8])],
    ]);
    const origEntries = [...data.entries()].map(([k, v]) => [k, new Set(v)] as const);
    [...toposort(data)];
    for (const [k, origV] of origEntries) {
      expect(data.get(k)).toEqual(origV);
    }
  });

  it('test_sort_flatten', () => {
    const data = new Map<number, Set<number>>([
      [2, new Set([11])],
      [9, new Set([11, 8])],
      [10, new Set([11, 3])],
      [11, new Set([7, 5])],
      [8, new Set([7, 3, 8])],
    ]);

    const expected = [new Set([3, 5, 7]), new Set([8, 11]), new Set([2, 9, 10])];
    expect([...toposort(data)]).toEqual(expected);

    // Sorted flatten
    const sortedResult: number[] = [];
    for (const item of expected) {
      sortedResult.push(...[...item].sort((a, b) => a - b));
    }
    expect(toposortFlatten(data)).toEqual(sortedResult);

    // Unsorted flatten — verify the groups match
    const unsorted = toposortFlatten(data, false);
    const groups = [
      new Set(unsorted.slice(0, 3)),
      new Set(unsorted.slice(3, 5)),
      new Set(unsorted.slice(5, 8)),
    ];
    expect(groups).toEqual(expected);
  });

  it('test_objects', () => {
    // Test with object keys (identity-based) instead of primitives
    const a = { name: 'a' };
    const b = { name: 'b' };
    const c = { name: 'c' };
    const data = new Map<object, Set<object>>([
      [a, new Set([b])],
      [b, new Set([c])],
      [c, new Set()],
    ]);
    const result = [...toposort(data)];
    expect(result.length).toBe(3);
    expect(result[0]).toEqual(new Set([c]));
    expect(result[1]).toEqual(new Set([b]));
    expect(result[2]).toEqual(new Set([a]));
  });

  it('test_input_not_modified_when_cycle_error', () => {
    const data = new Map<number, Set<number>>([
      [1, new Set([2])],
      [2, new Set([1])],
      [3, new Set([4])],
    ]);
    const origEntries = [...data.entries()].map(([k, v]) => [k, new Set(v)] as const);
    try { [...toposort(data)]; } catch { /* expected */ }
    for (const [k, origV] of origEntries) {
      expect(data.get(k)).toEqual(origV);
    }
  });
});
