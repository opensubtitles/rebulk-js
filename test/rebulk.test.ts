import { describe, it, expect } from 'vitest';
import { Rebulk } from '../src/index.js';

describe('Rebulk', () => {
  it('matches regex patterns', () => {
    const rebulk = new Rebulk();
    rebulk.regex('(?<year>\\d{4})', { name: 'year', formatter: { year: (v: string) => parseInt(v, 10) } });

    const matches = rebulk.matches('Movie.2024.mkv');
    const dict = Object.fromEntries(matches.toDict());
    expect(dict.year).toBe(2024);
  });

  it('matches string patterns', () => {
    const rebulk = new Rebulk();
    rebulk.stringDefaults({ ignoreCase: true });
    rebulk.string('HD', { name: 'quality', value: 'HD' });
    rebulk.string('SD', { name: 'quality', value: 'SD' });

    const matches = rebulk.matches('Movie.HD.mkv');
    const dict = Object.fromEntries(matches.toDict());
    expect(dict.quality).toBe('HD');
  });

  it('matches functional patterns', () => {
    const rebulk = new Rebulk();
    rebulk.functional(
      (input: string) => {
        const results: Array<[number, number]> = [];
        const re = /\b(\d{4})\b/g;
        let m;
        while ((m = re.exec(input)) !== null) {
          results.push([m.index, m.index + m[0].length]);
        }
        return results;
      },
      { name: 'number' },
    );

    const matches = rebulk.matches('Test 2024 data');
    expect(matches.named('number').length).toBe(1);
  });

  it('resolves conflicts (longer wins)', () => {
    const rebulk = new Rebulk();
    rebulk.string('HD', { name: 'quality', value: 'HD' });
    rebulk.string('HDTV', { name: 'source', value: 'HDTV' });

    const matches = rebulk.matches('Movie.HDTV.mkv');
    const dict = Object.fromEntries(matches.toDict());
    expect(dict.source).toBe('HDTV');
    expect(dict.quality).toBeUndefined();
  });

  it('finds holes in matches', () => {
    const rebulk = new Rebulk();
    rebulk.regex('\\d{4}', { name: 'year' });
    rebulk.string('mkv', { name: 'ext' });

    const matches = rebulk.matches('Title.2024.mkv');
    const holes = matches.holes();
    expect(holes.length).toBeGreaterThan(0);
    expect(holes.some((h: any) => h.value?.includes('Title'))).toBe(true);
  });

  it('supports multiple rebulk compositions', () => {
    const r1 = new Rebulk();
    r1.regex('\\d{4}', { name: 'year' });

    const r2 = new Rebulk();
    r2.string('HD', { name: 'quality', value: 'HD' });

    const combined = new Rebulk();
    combined.rebulk(r1);
    combined.rebulk(r2);

    const matches = combined.matches('Movie.2024.HD');
    const dict = Object.fromEntries(matches.toDict());
    expect(dict.year).toBeDefined();
    expect(dict.quality).toBe('HD');
  });

  it('supports chain patterns', () => {
    const rebulk = new Rebulk();
    rebulk.chain({ name: 'season_episode', children: true, privateParent: true })
      .regex('S(?<season>\\d+)')
      .regex('E(?<episode>\\d+)');

    const matches = rebulk.matches('Show.S01E02.mkv');
    const dict = Object.fromEntries(matches.toDict());
    expect(dict.season).toBeDefined();
    expect(dict.episode).toBeDefined();
  });
});
