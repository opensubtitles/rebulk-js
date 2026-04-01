/**
 * Misc helper functions — port of rebulk/loose.py
 */
import { isIterable } from './utils.js';

/** Wrap a non-array value in an array; return [] for null/undefined. */
export function ensureList<T>(param: T | T[] | null | undefined): T[] {
  if (!param) return [];
  if (Array.isArray(param)) return param;
  return [param];
}

/**
 * Return [dict, defaultValue].
 * If `param` is not a plain object, it becomes the default value.
 */
export function ensureDict<T>(
  param: T | Record<string, T> | null | undefined,
  defaultValue: T | undefined,
  defaultKey: string | null = null,
): [Record<string, T>, T | undefined] {
  if (!param) {
    return [{ [defaultKey as string]: param as T }, defaultValue];
  }
  if (typeof param !== 'object' || Array.isArray(param)) {
    return [{ [defaultKey as string]: param as T }, param as T];
  }
  const asObj = param as Record<string, T>;
  return [asObj, defaultValue];
}

/**
 * Filter a collection by predicate and optionally return a single element by index.
 * If index is not found, returns undefined.
 */
export function filterIndex<T>(
  collection: T[],
  predicate?: ((item: T) => boolean) | number | null,
  index?: number | null,
): T[] | T | undefined {
  // Allow filterIndex(list, index) shorthand
  if (typeof predicate === 'number') {
    index = predicate;
    predicate = null;
  }
  let result = predicate ? collection.filter(predicate) : [...collection];
  if (index !== null && index !== undefined) {
    if (index < 0) return result[result.length + index];
    return result[index];
  }
  return result;
}

/**
 * Return the first defined value for the given keys in data.
 * Port of Python rebulk/loose.py get_first_defined.
 */
export function getFirstDefined<T>(
  data: Record<string, T | undefined>,
  keys: Iterable<string | null | undefined>,
  defaultValue?: T,
  ignoreValues?: T[],
): T | undefined {
  const ignore = ignoreValues ?? [];
  for (const key of keys) {
    if (key !== null && key !== undefined && key in data) {
      const v = data[key as string];
      if (!ignore.includes(v as T)) return v;
    }
  }
  return defaultValue;
}

/**
 * Merge `defaults` into `kwargs`, optionally overriding existing keys.
 * Handles the special `clear` key: if true, clears kwargs first.
 */
export function setDefaults(
  defaults: Record<string, unknown>,
  kwargs: Record<string, unknown>,
  override = false,
): void {
  if ('clear' in defaults && defaults['clear']) {
    for (const key of Object.keys(kwargs)) delete kwargs[key];
    delete defaults['clear'];
  }
  for (const [key, value] of Object.entries(defaults)) {
    if (key in kwargs) {
      // Merge lists and dicts
      if (Array.isArray(value) && Array.isArray(kwargs[key])) {
        kwargs[key] = [...(value as unknown[]), ...(kwargs[key] as unknown[])];
        continue;
      }
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        kwargs[key] &&
        typeof kwargs[key] === 'object' &&
        !Array.isArray(kwargs[key])
      ) {
        setDefaults(value as Record<string, unknown>, kwargs[key] as Record<string, unknown>);
        continue;
      }
    }
    if (!(key in kwargs) || override) {
      kwargs[key] = value;
    }
  }
}
