/**
 * Debug tools — port of rebulk/debug.py
 *
 * Can be configured by changing values of these variables.
 *
 * DEBUG = false
 * Enable this variable to activate debug features (like defined_at parameters).
 *
 * LOG_LEVEL = 10
 * Default log level of generated rebulk logs.
 */

export let DEBUG = false;
export let LOG_LEVEL = 10; // logging.DEBUG equivalent

export interface Frame {
  lineno: number;
  package_: string | undefined;
  name: string | undefined;
  filename: string;
}

export function frameRepr(frame: Frame): string {
  const basename = frame.filename.split('/').pop() ?? frame.filename;
  return `${basename}#L${frame.lineno}`;
}

/**
 * Get definition location of a pattern or a match (outside of rebulk package).
 * In JS, we use Error stack traces to approximate Python's inspect.currentframe().
 */
export function definedAt(): Frame | undefined {
  if (!DEBUG) return undefined;

  const err = new Error();
  const stack = err.stack;
  if (!stack) return undefined;

  const lines = stack.split('\n').slice(1); // skip "Error" line
  for (const line of lines) {
    // Skip frames from within the rebulk-js src directory
    if (line.includes('/src/') && (
      line.includes('/rebulk-js/src/') ||
      line.includes('/rebulk-js/dist/')
    )) {
      continue;
    }
    // Parse the stack frame
    const match = line.match(/at\s+(?:(.+?)\s+)?\(?(.+?):(\d+):\d+\)?/);
    if (match) {
      return {
        lineno: parseInt(match[3], 10),
        package_: undefined,
        name: match[1] || undefined,
        filename: match[2],
      };
    }
  }
  return undefined;
}

export function setDebug(value: boolean): void {
  DEBUG = value;
}

export function setLogLevel(value: number): void {
  LOG_LEVEL = value;
}
