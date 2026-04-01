/**
 * Formatter utilities — port of rebulk/formatters.py
 */

export type FormatterFn = (value: string) => unknown;

/** Identity formatter — returns the raw string as-is. */
export function defaultFormatter(value: string): string {
  return value;
}

/**
 * Chain multiple formatter functions together.
 * Equivalent to Python: formatters(f1, f2, ...) = lambda s: f2(f1(s))
 */
export function formatters(...fns: FormatterFn[]): FormatterFn {
  return (value: string) => {
    let result: unknown = value;
    for (const fn of fns) {
      result = fn(result as string);
    }
    return result;
  };
}
