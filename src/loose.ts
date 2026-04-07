/**
 * Misc helper functions — port of rebulk/loose.py
 */

/**
 * Call a function with given args, filtering extra positional args
 * that exceed the function's declared parameter count.
 *
 * Port of Python rebulk/loose.py call() — in Python this introspects
 * function signatures to strip unsupported kwargs. In JS, functions
 * silently accept extra positional args, but we still trim them to
 * match Function.length (declared parameter count) when the function
 * does NOT use rest params.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function call(fn: (...args: any[]) => any, ...args: any[]): any {
  // Function.length gives the number of declared parameters (excluding rest params).
  // If the function has rest params, length may be 0 or fewer than args.
  // We trim args to fn.length only when fn.length > 0 (non-rest).
  if (fn.length > 0 && args.length > fn.length) {
    return fn(...args.slice(0, fn.length));
  }
  return fn(...args);
}

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
    param = defaultValue as T;
  }
  if (typeof param !== 'object' || param === null || Array.isArray(param)) {
    if (param) {
      defaultValue = param as T;
    }
    const key = defaultKey ?? (undefined as unknown as string);
    return [{ [key]: param } as Record<string, T>, defaultValue];
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
