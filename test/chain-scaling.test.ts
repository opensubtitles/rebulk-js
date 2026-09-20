/**
 * Chain matching used to be quadratic in the input length: every offset was
 * handed the entire rest of the string, while `ChainPart._truncateRepeater`
 * keeps only the matches running contiguously from the start of that slice, so
 * nearly all of each scan was discarded. The walk is now windowed and slides
 * when a window holds no chain.
 *
 * These pin both halves of that — the cost stays linear, and windowing still
 * finds a chain that sits far beyond the first window.
 */
import { describe, it, expect } from 'vitest';
import { Rebulk } from '../src/index.js';

/** A season/episode chain of the shape that showed the blow-up. */
function build(): Rebulk {
  const rebulk = new Rebulk();
  rebulk.defaults({ children: true });
  rebulk
    .chain()
    .regex('S(?P<season>\\d{2})')
    .regex('E(?P<episode>\\d{2})')
    .close();
  return rebulk;
}

function seasonsOf(input: string): unknown[] {
  return build().matches(input).named('season').map((m) => m.value);
}

function timeParse(input: string): number {
  const rebulk = build();
  rebulk.matches('warmup S01E01');
  const t0 = Date.now();
  rebulk.matches(input);
  return Date.now() - t0;
}

describe('chain scaling', () => {
  it('matches the chain at all (guards the tests below)', () => {
    expect(seasonsOf('Show.S01E01.1080p')).toEqual(['01']);
  });

  it('stays roughly linear as the input grows', () => {
    const small = Array(200).fill('S01E01').join('.');
    const large = Array(800).fill('S01E01').join('.');

    // Repeat to damp scheduler noise on a small absolute cost.
    let tSmall = 0;
    let tLarge = 0;
    for (let i = 0; i < 3; i++) {
      tSmall += timeParse(small);
      tLarge += timeParse(large);
    }

    // Four times the input. Quadratic measured ~15x here before the fix, linear
    // is ~4x. The threshold sits between them with room for a noisy machine.
    expect(tLarge / Math.max(tSmall, 1)).toBeLessThan(9);
  });

  it('finds a chain beginning far beyond the first scan window', () => {
    expect(seasonsOf('x'.repeat(4000) + '.S03E07.')).toEqual(['03']);
  });

  it('finds every chain across a long input', () => {
    const input = ['S01E01', 'y'.repeat(2000), 'S02E02', 'z'.repeat(2000), 'S03E03'].join('.');
    expect(seasonsOf(input)).toEqual(['01', '02', '03']);
  });
});
