/**
 * Validator utilities — port of rebulk/validators.py
 */
import type { Match } from './match.js';

export type ValidatorFn = (match: Match) => boolean;

/** Always returns true (the default no-op validator). */
export function alwaysTrue(_match: Match): boolean {
  return true;
}

/**
 * Return true if the character immediately before the match is in `chars`.
 */
export function charsBefore(chars: string, match: Match): boolean {
  if (!match.inputString) return true;
  const idx = match.start - 1;
  if (idx < 0) return true;
  return chars.includes(match.inputString[idx]);
}

/**
 * Return true if the character immediately after the match is in `chars`.
 */
export function charsAfter(chars: string, match: Match): boolean {
  if (!match.inputString) return true;
  const idx = match.end;
  if (idx >= match.inputString.length) return true;
  return chars.includes(match.inputString[idx]);
}

/**
 * Return true if both the character before AND after the match are in `chars`.
 */
export function charsSurround(chars: string, match: Match): boolean {
  return charsBefore(chars, match) && charsAfter(chars, match);
}

/**
 * Chain multiple validators into one. All must pass for the match to be valid.
 */
export function validators(...chainedValidators: ValidatorFn[]): ValidatorFn {
  return (match: Match) => chainedValidators.every(v => v(match));
}
