/**
 * Loose utilities tests — port of rebulk/test/test_loose.py
 *
 * Note: Python's loose.call() introspects function signatures to filter args/kwargs.
 * In JS, functions silently accept extra positional args, so call() is a simple pass-through.
 * We test the JS-adapted version which still exercises the core loose utilities.
 */
import { describe, it, expect } from 'vitest';
import { ensureList, ensureDict, filterIndex, setDefaults } from '../src/loose.js';

describe('Loose Utilities', () => {
  it('test_ensure_list', () => {
    expect(ensureList(null)).toEqual([]);
    expect(ensureList(undefined)).toEqual([]);
    expect(ensureList(0)).toEqual([]);
    expect(ensureList('')).toEqual([]);
    expect(ensureList('abc')).toEqual(['abc']);
    expect(ensureList(42)).toEqual([42]);
    expect(ensureList([1, 2, 3])).toEqual([1, 2, 3]);
    expect(ensureList([])).toEqual([]);
  });

  it('test_ensure_dict', () => {
    // Non-dict param gets promoted to default value
    const [dict1, def1] = ensureDict('hello', 'default_val');
    expect(def1).toBe('hello');

    // Dict param stays as dict
    const [dict2, def2] = ensureDict({ key: 'val' }, 'default_val');
    expect(dict2).toEqual({ key: 'val' });
    expect(def2).toBe('default_val');

    // Falsy param uses default value
    const [dict3, def3] = ensureDict(null, 'default_val');
    expect(def3).toBe('default_val');
  });

  it('test_filter_index - basic filtering', () => {
    const items = [1, 2, 3, 4, 5];

    // No predicate, no index — returns all
    expect(filterIndex(items)).toEqual([1, 2, 3, 4, 5]);

    // With predicate
    expect(filterIndex(items, (x: number) => x > 3)).toEqual([4, 5]);

    // With index (int as second arg)
    expect(filterIndex(items, 0)).toBe(1);
    expect(filterIndex(items, -1)).toBe(5);

    // With predicate and index
    expect(filterIndex(items, (x: number) => x > 2, 0)).toBe(3);

    // Index out of bounds returns undefined
    expect(filterIndex(items, 10)).toBeUndefined();
  });

  it('test_set_defaults', () => {
    // Basic defaults
    const kwargs: Record<string, unknown> = { a: 1 };
    setDefaults({ b: 2, c: 3 }, kwargs);
    expect(kwargs).toEqual({ a: 1, b: 2, c: 3 });

    // Existing keys not overridden
    const kwargs2: Record<string, unknown> = { a: 1 };
    setDefaults({ a: 99, b: 2 }, kwargs2);
    expect(kwargs2).toEqual({ a: 1, b: 2 });

    // Override mode
    const kwargs3: Record<string, unknown> = { a: 1 };
    setDefaults({ a: 99 }, kwargs3, true);
    expect(kwargs3).toEqual({ a: 99 });

    // List merging (prepend)
    const kwargs4: Record<string, unknown> = { tags: ['b'] };
    setDefaults({ tags: ['a'] }, kwargs4);
    expect(kwargs4.tags).toEqual(['a', 'b']);
  });

  it('test_set_defaults_clear', () => {
    const kwargs: Record<string, unknown> = { a: 1, b: 2 };
    setDefaults({ clear: true, c: 3 }, kwargs);
    expect(kwargs).toEqual({ c: 3 });
  });

  it('test_set_defaults_nested_dict', () => {
    const kwargs: Record<string, unknown> = { nested: { a: 1 } };
    setDefaults({ nested: { b: 2 } }, kwargs);
    expect(kwargs.nested).toEqual({ a: 1, b: 2 });
  });
});
