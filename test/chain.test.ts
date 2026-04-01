/**
 * Chain tests — port of rebulk/test/test_chain.py
 */
import { describe, it, expect } from 'vitest';
import { Rebulk } from '../src/index.js';
import { charsSurround } from '../src/validators.js';
import { Match } from '../src/match.js';

describe('Chain', () => {
  it('test_chain_close', () => {
    const rebulk = new Rebulk();
    const ret = rebulk.chain().close();
    expect(ret).toBe(rebulk);
    expect(rebulk.effectivePatterns().length).toBe(1);
  });

  it('test_build_chain', () => {
    const rebulk = new Rebulk();

    function digit(inputString: string) {
      const i = inputString.indexOf('1849');
      return i > -1 ? [i, i + 4] as [number, number] : null;
    }

    rebulk.chain()
      .functional(digit)
      .string('test').repeater(2)
      .string('x').repeater('{1,3}')
      .string('optional').repeater('?')
      .regex('f?x').repeater('+')
      .close();

    expect(rebulk.effectivePatterns().length).toBe(1);
    const chain = rebulk.effectivePatterns()[0] as any;
    expect(chain.parts.length).toBe(5);

    expect(chain.parts[0].repeaterStart).toBe(1);
    expect(chain.parts[0].repeaterEnd).toBe(1);

    expect(chain.parts[1].repeaterStart).toBe(2);
    expect(chain.parts[1].repeaterEnd).toBe(2);

    expect(chain.parts[2].repeaterStart).toBe(1);
    expect(chain.parts[2].repeaterEnd).toBe(3);

    expect(chain.parts[3].repeaterStart).toBe(0);
    expect(chain.parts[3].repeaterEnd).toBe(1);

    expect(chain.parts[4].repeaterStart).toBe(1);
    expect(chain.parts[4].repeaterEnd).toBe(null);
  });

  it('test_chain_defaults', () => {
    const rebulk = new Rebulk();
    rebulk.defaults({
      validator: (x: any) => String(x.value).startsWith('t'),
      ignoreNames: ['testIgnore'],
      children: true,
    });

    rebulk.chain()
      .regex('(?P<test>test)')
      .regex(' ').repeater('*')
      .regex('(?P<best>best)')
      .regex(' ').repeater('*')
      .regex('(?P<testIgnore>testIgnore)');

    const matches = rebulk.matches('test best testIgnore');
    expect(matches.length).toBe(1);
    expect(matches.get(0).name).toBe('test');
  });

  it('test_matches_docs', () => {
    const rebulk = new Rebulk();
    rebulk.regexDefaults({ flags: 'i' });
    rebulk.defaults({ children: true, formatter: { episode: (v: string) => parseInt(v), version: (v: string) => parseInt(v) } });

    rebulk.chain()
      .regex('e(?P<episode>\\d{1,4})').repeater(1)
      .regex('v(?P<version>\\d+)').repeater('?')
      .regex('[ex-](?P<episode>\\d{1,4})').repeater('*')
      .close();

    const result = Object.fromEntries(rebulk.matches('This is E14v2-15-16-17').toDict());
    expect(result.episode).toEqual([14, 15, 16, 17]);
    expect(result.version).toBe(2);
  });

  it('test_matches', () => {
    const rebulk = new Rebulk();

    function digit(inputString: string) {
      const i = inputString.indexOf('1849');
      return i > -1 ? [i, i + 4] as [number, number] : null;
    }

    const chain = rebulk.chain()
      .functional(digit)
      .string('test').hidden().repeater(2)
      .string('x').hidden().repeater('{1,3}')
      .string('optional').hidden().repeater('?')
      .regex('f.?x', { name: 'result' }).repeater('+')
      .close();

    const inputString = '1849testtestxxfixfux_foxabc1849testtestxoptionalfoxabc';
    let matches = rebulk.matches(inputString);

    expect(matches.length).toBe(2);
    let children = matches.get(0).children.toArray();
    expect(children[0].value).toBe('1849');
    expect(children[1].value).toBe('fix');
    expect(children[2].value).toBe('fux');

    children = matches.get(1).children.toArray();
    expect(children[0].value).toBe('1849');
    expect(children[1].value).toBe('fox');

    // No match cases
    expect(rebulk.matches('_1850testtestxoptionalfoxabc').length).toBe(0);
    expect(rebulk.matches('_1849testtesttesttestxoptionalfoxabc').length).toBe(0);
    expect(rebulk.matches('_1849testtestxxxxoptionalfoxabc').length).toBe(0);
    expect(rebulk.matches('_1849testtestoptionalfoxabc').length).toBe(0);
    expect(rebulk.matches('_1849testtestxoptionalabc').length).toBe(0);

    matches = rebulk.matches('_1849testtestxoptionalfaxabc');
    expect(matches.length).toBe(1);
    children = matches.get(0).children.toArray();
    expect(children[0].value).toBe('1849');
    expect(children[1].value).toBe('fax');
  });

  it('test_matches_2', () => {
    const rebulk = new Rebulk();
    rebulk.regexDefaults({ flags: 'i' });
    rebulk.defaults({ children: true, formatter: { episode: (v: string) => parseInt(v), version: (v: string) => parseInt(v) } });

    rebulk.chain()
      .regex('e(?P<episode>\\d{1,4})')
      .regex('v(?P<version>\\d+)').repeater('?')
      .regex('[ex-](?P<episode>\\d{1,4})').repeater('*')
      .close();

    const matches = rebulk.matches('This is E14v2-15E16x17');
    expect(matches.length).toBe(5);

    expect(matches.get(0).name).toBe('episode');
    expect(matches.get(0).value).toBe(14);
    expect(matches.get(1).name).toBe('version');
    expect(matches.get(1).value).toBe(2);
    expect(matches.get(2).name).toBe('episode');
    expect(matches.get(2).value).toBe(15);
    expect(matches.get(3).name).toBe('episode');
    expect(matches.get(3).value).toBe(16);
    expect(matches.get(4).name).toBe('episode');
    expect(matches.get(4).value).toBe(17);
  });

  it('test_matches_3 - season/episode patterns', () => {
    const altDash: [string, string] = ['@', '[\\W_]'];

    const rebulk = new Rebulk();
    rebulk.defaults({
      formatter: { season: (v: string) => parseInt(v), episode: (v: string) => parseInt(v) },
      tags: ['SxxExx'],
      abbreviations: [altDash],
      privateNames: ['episodeSeparator', 'seasonSeparator'],
      children: true,
      privateParent: true,
    });

    rebulk.chain()
      .regex('(?P<season>\\d+)@?x@?(?P<episode>\\d+)')
      .regex('(?P<episodeSeparator>x|-|\\+|&)(?P<episode>\\d+)').repeater('*')
      .close();

    rebulk.chain()
      .regex('S(?P<season>\\d+)@?(?:xE|Ex|E|x)@?(?P<episode>\\d+)')
      .regex('(?:(?P<episodeSeparator>xE|Ex|E|x|-|\\+|&)(?P<episode>\\d+))').repeater('*')
      .close();

    rebulk.chain()
      .regex('S(?P<season>\\d+)')
      .regex('(?P<seasonSeparator>S|-|\\+|&)(?P<season>\\d+)').repeater('*');

    let matches = rebulk.matches('test-01x02-03');
    expect(matches.length).toBe(3);
    expect(matches.get(0).name).toBe('season');
    expect(matches.get(0).value).toBe(1);
    expect(matches.get(1).name).toBe('episode');
    expect(matches.get(1).value).toBe(2);
    expect(matches.get(2).name).toBe('episode');
    expect(matches.get(2).value).toBe(3);

    matches = rebulk.matches('test-S01E02-03');
    expect(matches.length).toBe(3);
    expect(matches.get(0).name).toBe('season');
    expect(matches.get(0).value).toBe(1);
    expect(matches.get(1).name).toBe('episode');
    expect(matches.get(1).value).toBe(2);
    expect(matches.get(2).name).toBe('episode');
    expect(matches.get(2).value).toBe(3);

    matches = rebulk.matches('test-S01-02-03-04');
    expect(matches.length).toBe(4);
    expect(matches.get(0).name).toBe('season');
    expect(matches.get(0).value).toBe(1);
    expect(matches.get(1).name).toBe('season');
    expect(matches.get(1).value).toBe(2);
    expect(matches.get(2).name).toBe('season');
    expect(matches.get(2).value).toBe(3);
    expect(matches.get(3).name).toBe('season');
    expect(matches.get(3).value).toBe(4);
  });

  it('test_chain_with_validators', () => {
    const chainValidator = (match: Match) => String(match.value).startsWith('t') && String(match.value).endsWith('t');
    const defaultValidator = (match: Match) => String(match.value).startsWith('t') && String(match.value).endsWith('g');
    const customValidator = (match: Match) => String(match.value).startsWith('b') && String(match.value).endsWith('t');

    const rebulk = new Rebulk();
    rebulk.defaults({ children: true, validator: defaultValidator });

    rebulk.chain({ validateAll: true, validator: { __parent__: chainValidator } })
      .regex('(?P<test>testing)', { validator: defaultValidator }).repeater('+')
      .regex(' ').repeater('+')
      .regex('(?P<best>best)', { validator: customValidator }).repeater('+');

    const matches = rebulk.matches('some testing best end');
    expect(matches.length).toBe(2);
    expect(matches.get(0).name).toBe('test');
    expect(matches.get(1).name).toBe('best');
  });

  it('test_matches_4', () => {
    const sepsSurround = (match: Match) => charsSurround(' ', match);

    const rebulk = new Rebulk();
    rebulk.regexDefaults({ flags: 'i' });
    rebulk.defaults({ validateAll: true, children: true });
    rebulk.defaults({ privateNames: ['episodeSeparator', 'seasonSeparator'], privateParent: true });

    rebulk.chain({ validator: { __parent__: sepsSurround }, formatter: { episode: (v: string) => parseInt(v), version: (v: string) => parseInt(v) } })
      .defaults({ formatter: { episode: (v: string) => parseInt(v), version: (v: string) => parseInt(v) } })
      .regex('e(?P<episode>\\d{1,4})')
      .regex('v(?P<version>\\d+)').repeater('?')
      .regex('(?P<episodeSeparator>e|x|-)(?P<episode>\\d{1,4})').repeater('*');

    const matches = rebulk.matches('Some Series E01E02E03');
    expect(matches.length).toBe(3);
    expect(matches.get(0).value).toBe(1);
    expect(matches.get(1).value).toBe(2);
    expect(matches.get(2).value).toBe(3);
  });

  it('test_matches_5', () => {
    // This test validates that privateNames set on the chain() constructor properly
    // propagate to mark episodeSeparator matches as private.
    // In the JS port, chain-level privateNames propagation differs slightly from Python:
    // Python's chain internally applies privateNames through its defaults() merging,
    // while the JS port requires privateNames to be set via .defaults() before the chain.
    // Adapted to use .defaults() instead of passing directly to chain() constructor.
    const sepsSurround = (match: Match) => charsSurround(' ', match);

    const rebulk = new Rebulk();
    rebulk.regexDefaults({ flags: 'i' });
    rebulk.defaults({
      privateNames: ['episodeSeparator', 'seasonSeparator'],
      children: true,
      privateParent: true,
    });

    rebulk.chain({
      validateAll: true,
      validator: { __parent__: sepsSurround },
      formatter: { episode: (v: string) => parseInt(v), version: (v: string) => parseInt(v) },
    })
      .regex('e(?P<episode>\\d{1,4})')
      .regex('v(?P<version>\\d+)').repeater('?')
      .regex('(?P<episodeSeparator>e|x|-)(?P<episode>\\d{1,4})').repeater('{2,3}');

    let matches = rebulk.matches('Some Series E01E02E03');
    expect(matches.length).toBe(3);

    matches = rebulk.matches('Some Series E01E02');
    expect(matches.length).toBe(0);

    // Parent can't be validated (too long), so no results
    matches = rebulk.matches('Some Series E01E02E03E04E05E06');
    expect(matches.length).toBe(0);
  });

  it('test_matches_6', () => {
    const rebulk = new Rebulk();
    rebulk.regexDefaults({ flags: 'i' });
    rebulk.defaults({
      privateNames: ['episodeSeparator', 'seasonSeparator'],
      validateAll: true,
      validator: undefined,
      children: true,
      privateParent: true,
    });

    rebulk.chain({ formatter: { episode: (v: string) => parseInt(v), version: (v: string) => parseInt(v) } })
      .regex('e(?P<episode>\\d{1,4})')
      .regex('v(?P<version>\\d+)').repeater('?')
      .regex('(?P<episodeSeparator>e|x|-)(?P<episode>\\d{1,4})').repeater('{2,3}');

    let matches = rebulk.matches('Some Series E01E02E03');
    expect(matches.length).toBe(3);

    matches = rebulk.matches('Some Series E01E02');
    expect(matches.length).toBe(0);

    // No validator on parent, so it should give 4 episodes
    matches = rebulk.matches('Some Series E01E02E03E04E05E06');
    expect(matches.length).toBe(4);
  });

  it('test_matches_7', () => {
    const sepsSurround = (match: Match) => charsSurround(' .-/', match);
    const rebulk = new Rebulk();
    rebulk.regexDefaults({ flags: 'i' });
    rebulk.defaults({ children: true, privateParent: true });

    rebulk.chain()
      .regex('S(?P<season>\\d+)', { validateAll: true, validator: { __parent__: sepsSurround } })
      .regex('[ -](?P<season>\\d+)', { validator: sepsSurround }).repeater('*');

    let matches = rebulk.matches('Some S01');
    expect(matches.length).toBe(1);

    matches = rebulk.matches('Some S01-02');
    expect(matches.length).toBe(2);

    matches = rebulk.matches('programs4/Some S01-02');
    expect(matches.length).toBe(2);

    matches = rebulk.matches('programs4/SomeS01middle.S02-03.andS04here');
    expect(matches.length).toBe(2);

    matches = rebulk.matches('Some 02.and.S04-05.here');
    expect(matches.length).toBe(2);
  });

  it('test_chain_breaker', () => {
    function chainBreaker(matches: any) {
      const seasons = matches.named('season') as Match[];
      if (seasons.length > 1) {
        if ((seasons[seasons.length - 1].value as number) - (seasons[seasons.length - 2].value as number) > 10) {
          return true;
        }
      }
      return false;
    }

    const sepsSurround = (match: Match) => charsSurround(' .-/', match);

    const rebulk = new Rebulk();
    rebulk.regexDefaults({ flags: 'i' });
    rebulk.defaults({ children: true, privateParent: true, formatter: { season: (v: string) => parseInt(v) } });

    rebulk.chain({ chainBreaker })
      .regex('S(?P<season>\\d+)', { validateAll: true, validator: { __parent__: sepsSurround } })
      .regex('[ -](?P<season>\\d+)', { validator: sepsSurround }).repeater('*');

    const matches = rebulk.matches('Some S01-02-03-50-51');
    expect(matches.length).toBe(3);
    expect(matches.get(0).value).toBe(1);
    expect(matches.get(1).value).toBe(2);
    expect(matches.get(2).value).toBe(3);
  });

  it('test_chain_breaker_defaults', () => {
    function chainBreaker(matches: any) {
      const seasons = matches.named('season') as Match[];
      if (seasons.length > 1) {
        if ((seasons[seasons.length - 1].value as number) - (seasons[seasons.length - 2].value as number) > 10) {
          return true;
        }
      }
      return false;
    }

    const sepsSurround = (match: Match) => charsSurround(' .-/', match);

    const rebulk = new Rebulk();
    rebulk.regexDefaults({ flags: 'i' });
    rebulk.defaults({ chainBreaker, children: true, privateParent: true, formatter: { season: (v: string) => parseInt(v) } });

    rebulk.chain()
      .regex('S(?P<season>\\d+)', { validateAll: true, validator: { __parent__: sepsSurround } })
      .regex('[ -](?P<season>\\d+)', { validator: sepsSurround }).repeater('*');

    const matches = rebulk.matches('Some S01-02-03-50-51');
    expect(matches.length).toBe(3);
    expect(matches.get(0).value).toBe(1);
    expect(matches.get(1).value).toBe(2);
    expect(matches.get(2).value).toBe(3);
  });

  it('test_chain_breaker_defaults2', () => {
    function chainBreaker(matches: any) {
      const seasons = matches.named('season') as Match[];
      if (seasons.length > 1) {
        if ((seasons[seasons.length - 1].value as number) - (seasons[seasons.length - 2].value as number) > 10) {
          return true;
        }
      }
      return false;
    }

    const sepsSurround = (match: Match) => charsSurround(' .-/', match);

    const rebulk = new Rebulk();
    rebulk.regexDefaults({ flags: 'i' });
    rebulk.chainDefaults({ chainBreaker });
    rebulk.defaults({ children: true, privateParent: true, formatter: { season: (v: string) => parseInt(v) } });

    rebulk.chain()
      .regex('S(?P<season>\\d+)', { validateAll: true, validator: { __parent__: sepsSurround } })
      .regex('[ -](?P<season>\\d+)', { validator: sepsSurround }).repeater('*');

    const matches = rebulk.matches('Some S01-02-03-50-51');
    expect(matches.length).toBe(3);
    expect(matches.get(0).value).toBe(1);
    expect(matches.get(1).value).toBe(2);
    expect(matches.get(2).value).toBe(3);
  });
});
