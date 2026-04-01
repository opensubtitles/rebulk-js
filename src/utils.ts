/**
 * Utility functions — port of rebulk/utils.py
 */

/** Check if a value is iterable (but not a string). */
export function isIterable(obj: unknown): obj is Iterable<unknown> {
  if (obj === null || obj === undefined) return false;
  if (typeof obj === 'string') return false;
  return typeof (obj as any)[Symbol.iterator] === 'function';
}

/**
 * Yield all start indices of `sub` inside `string`.
 * Mirrors Python rebulk find_all().
 */
export function* findAll(
  string: string,
  sub: string,
  start = 0,
  end?: number,
  ignoreCase = false,
): Generator<number> {
  let haystack = string;
  let needle = sub;
  if (ignoreCase) {
    haystack = haystack.toLowerCase();
    needle = needle.toLowerCase();
  }
  const limit = end !== undefined ? end : haystack.length;
  let idx = start;
  while (true) {
    const found = haystack.indexOf(needle, idx);
    if (found === -1 || found >= limit) return;
    yield found;
    idx = found + needle.length;
  }
}

/** Return the first value for a matching key in `data`, or `defaultValue`. */
export function getFirstDefined<T>(
  data: Record<string | symbol, T>,
  keys: Iterable<string | null | undefined>,
  defaultValue: T | undefined = undefined,
): T | undefined {
  for (const key of keys) {
    if (key !== null && key !== undefined && key in data) {
      return data[key as string];
    }
  }
  return defaultValue;
}

/** Extend `target` with elements from `source` that are not already present (by reference). */
export function extendSafe<T>(target: T[], source: T[]): void {
  for (const elt of source) {
    if (!target.includes(elt)) {
      target.push(elt);
    }
  }
}

/**
 * A Set that uses identity (===) rather than value equality for membership.
 * Mirrors Python rebulk IdentitySet.
 */
export class IdentitySet<T extends object> {
  private _map = new Map<T, true>();

  constructor(items?: Iterable<T>) {
    if (items) {
      for (const item of items) this.add(item);
    }
  }

  add(value: T): this {
    this._map.set(value, true);
    return this;
  }

  delete(value: T): boolean {
    return this._map.delete(value);
  }

  has(value: T): boolean {
    return this._map.has(value);
  }

  get size(): number {
    return this._map.size;
  }

  [Symbol.iterator](): Iterator<T> {
    return this._map.keys();
  }
}
