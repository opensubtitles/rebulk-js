/**
 * Debug tests — port of rebulk/test/test_debug.py
 *
 * Tests that defined_at tracking works end-to-end on Pattern, Match, Rule, and Rebulk objects.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setDebug, definedAt, frameRepr } from '../src/debug.js';
import type { Frame } from '../src/debug.js';
import { StringPattern } from '../src/pattern.js';
import { Match } from '../src/match.js';
import { Rebulk, Rule, RemoveMatch } from '../src/rebulk.js';
import type { Matches } from '../src/match.js';

class RuleRemove0 extends Rule {
  consequence = RemoveMatch;
  when(matches: Matches) { return matches.get(0); }
}

describe('Debug', () => {
  beforeAll(() => {
    setDebug(true);
  });

  afterAll(() => {
    setDebug(false);
  });

  it('test_pattern', () => {
    const pattern = new StringPattern({}, 'es');
    expect(pattern.defined_at).toBeDefined();
    expect(pattern.defined_at!.lineno).toBeGreaterThan(0);
    expect(pattern.defined_at!.filename).toContain('debug.test');
    // Python: repr(pattern) starts with '<StringPattern@test_debug.py#L'
    const repr = pattern.toString();
    expect(repr).toContain('StringPattern');
  });

  it('test_match', () => {
    const match = new Match(1, 3, { value: 'es' });
    expect(match.defined_at).toBeDefined();
    expect(match.defined_at!.lineno).toBeGreaterThan(0);
    expect(match.defined_at!.filename).toContain('debug.test');
  });

  it('test_rule', () => {
    const rule = new RuleRemove0();
    expect(rule.defined_at).toBeDefined();
    expect(rule.defined_at!.lineno).toBeGreaterThan(0);
    expect(rule.defined_at!.filename).toContain('debug.test');
    // Python: str(rule) starts with '<RuleRemove0@test_debug.py#L'
    expect(rule.toString()).toContain('RuleRemove0');
  });

  it('test_rebulk', () => {
    const rebulk = new Rebulk();
    rebulk.string('debug');
    rebulk.string('is');

    const inputString = 'This is a debug test';
    const matches = rebulk.matches(inputString);

    // Each pattern should have defined_at
    const patterns = (rebulk as any)._patterns;
    expect(patterns[0].defined_at).toBeDefined();
    expect(patterns[0].defined_at!.lineno).toBeGreaterThan(0);
    expect(patterns[0].defined_at!.filename).toContain('debug.test');

    expect(patterns[1].defined_at).toBeDefined();
    expect(patterns[1].defined_at!.lineno).toBeGreaterThan(0);
    expect(patterns[1].defined_at!.filename).toContain('debug.test');

    // Python: matches[0].defined_at == rebulk._patterns[0].defined_at
    // Match.defined_at comes from the pattern that created it
    expect(matches.get(0).defined_at).toBe(patterns[0].defined_at);
    expect(matches.get(1).defined_at).toBe(patterns[1].defined_at);
  });

  it('test_repr', () => {
    const rebulk = new Rebulk();
    rebulk.string('test');
    const matches = rebulk.matches('this is a test');
    // Python: str(matches) should work without error
    const repr = matches.toString();
    expect(repr).toBeTruthy();
  });

  it('test_defined_at_disabled', () => {
    setDebug(false);
    const frame = definedAt();
    expect(frame).toBeUndefined();

    // Pattern created with debug off should have no defined_at
    const pattern = new StringPattern({}, 'test');
    expect(pattern.defined_at).toBeUndefined();
    setDebug(true);
  });

  it('test_frame_repr', () => {
    const frame: Frame = {
      lineno: 42,
      package_: 'test',
      name: 'test_module',
      filename: '/path/to/test_debug.ts',
    };
    expect(frameRepr(frame)).toBe('test_debug.ts#L42');
  });
});
