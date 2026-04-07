/**
 * Rebulk integration tests — port of rebulk/test/test_rebulk.py
 */
import { describe, it, expect } from 'vitest';
import { Rebulk, Rule, RemoveMatch, CustomRule, Match } from '../src/index.js';
import type { Context } from '../src/pattern.js';
import type { Matches } from '../src/match.js';

describe('Rebulk', () => {
  it('test_rebulk_simple', () => {
    const rebulk = new Rebulk();
    rebulk.string('quick');
    rebulk.regex('f.x');

    rebulk.functional((inputString: string) => {
      const i = inputString.indexOf('over');
      return i > -1 ? [i, i + 4] as [number, number] : null;
    });

    const matches = rebulk.matches('The quick brown fox jumps over the lazy dog');
    expect(matches.length).toBe(3);
    expect(matches.get(0).value).toBe('quick');
    expect(matches.get(1).value).toBe('fox');
    expect(matches.get(2).value).toBe('over');
  });

  it('test_rebulk_composition', () => {
    const rebulk = new Rebulk();
    rebulk.string('quick');
    rebulk.rebulk(new Rebulk().regex('f.x'));
    rebulk.rebulk(new Rebulk({ disabled: () => true }).functional(() => null));

    const matches = rebulk.matches('The quick brown fox jumps over the lazy dog');
    expect(matches.length).toBe(2);
    expect(matches.get(0).value).toBe('quick');
    expect(matches.get(1).value).toBe('fox');
  });

  it('test_rebulk_context', () => {
    const rebulk = new Rebulk();
    const context = { nostring: true, word: 'lazy' };

    rebulk.string('quick', { disabled: (ctx: Context) => !!ctx.nostring });
    rebulk.regex('f.x', { disabled: (ctx: Context) => !!ctx.noregex });

    rebulk.functional((inputString: string, ctx?: Context) => {
      const word = (ctx?.word as string) ?? 'over';
      const i = inputString.indexOf(word);
      return i > -1 ? [i, i + word.length] as [number, number] : null;
    });

    const matches = rebulk.matches('The quick brown fox jumps over the lazy dog', context);
    expect(matches.length).toBe(2);
    expect(matches.get(0).value).toBe('fox');
    expect(matches.get(1).value).toBe('lazy');
  });

  it('test_rebulk_prefer_longer', () => {
    const matches = new Rebulk().string('quick').string('own').regex('br.{2}n')
      .matches('The quick brown fox jumps over the lazy dog');
    expect(matches.length).toBe(2);
    expect(matches.get(0).value).toBe('quick');
    expect(matches.get(1).value).toBe('brown');
  });

  it('test_rebulk_defaults', () => {
    const inputString = 'The quick brown fox jumps over the lazy dog';

    function func(inputString: string) {
      const i = inputString.indexOf('fox');
      return i > -1 ? [i, i + 3] as [number, number] : null;
    }

    let matches = new Rebulk()
      .stringDefaults({ name: 'string', tags: ['a', 'b'] })
      .regexDefaults({ name: 'regex' })
      .functionalDefaults({ name: 'functional' })
      .string('quick', { tags: ['c'] })
      .functional(func)
      .regex('br.{2}n')
      .matches(inputString);

    expect(matches.get(0).name).toBe('string');
    expect(matches.get(0).tags).toEqual(['a', 'b', 'c']);
    expect(matches.get(1).name).toBe('functional');
    expect(matches.get(2).name).toBe('regex');

    matches = new Rebulk()
      .defaults({ name: 'default', tags: ['0'] })
      .stringDefaults({ name: 'string', tags: ['a', 'b'] })
      .functionalDefaults({ name: 'functional', tags: ['1'] })
      .string('quick', { tags: ['c'] })
      .functional(func)
      .regex('br.{2}n')
      .matches(inputString);

    expect(matches.get(0).name).toBe('string');
    expect(matches.get(0).tags).toEqual(['0', 'a', 'b', 'c']);
    expect(matches.get(1).name).toBe('functional');
    expect(matches.get(1).tags).toEqual(['0', '1']);
    expect(matches.get(2).name).toBe('default');
    expect(matches.get(2).tags).toEqual(['0']);
  });

  it('test_rebulk_defaults_overrides', () => {
    const inputString = 'The quick brown fox jumps over the lazy dog';

    function func(inputString: string) {
      const i = inputString.indexOf('fox');
      return i > -1 ? [i, i + 3] as [number, number] : null;
    }

    const matches = new Rebulk()
      .stringDefaults({ name: 'string', tags: ['a', 'b'] })
      .regexDefaults({ name: 'regex', tags: ['d'] })
      .functionalDefaults({ name: 'functional' })
      .string('quick', { tags: ['c'], overrides: ['tags'] })
      .functional(func)
      .regex('br.{2}n')
      .matches(inputString);

    expect(matches.get(0).name).toBe('string');
    expect(matches.get(0).tags).toEqual(['c']);
    expect(matches.get(1).name).toBe('functional');
    expect(matches.get(2).name).toBe('regex');
    expect(matches.get(2).tags).toEqual(['d']);
  });

  it('test_rebulk_rebulk', () => {
    const inputString = 'The quick brown fox jumps over the lazy dog';
    const base = new Rebulk().string('quick');
    const child = new Rebulk().string('own').regex('br.{2}n');
    const matches = base.rebulk(child).matches(inputString);
    expect(matches.length).toBe(2);
    expect(matches.get(0).value).toBe('quick');
    expect(matches.get(1).value).toBe('brown');
  });

  it('test_rebulk_no_default', () => {
    const matches = new Rebulk({ defaultRules: false }).string('quick').string('own').regex('br.{2}n')
      .matches('The quick brown fox jumps over the lazy dog');
    expect(matches.length).toBe(3);
    expect(matches.get(0).value).toBe('quick');
    expect(matches.get(1).value).toBe('own');
    expect(matches.get(2).value).toBe('brown');
  });

  it('test_rebulk_empty_match', () => {
    const matches = new Rebulk({ defaultRules: false }).string('quick').string('own')
      .regex('br(.*?)own', { children: true })
      .matches('The quick brown fox jumps over the lazy dog');
    expect(matches.length).toBe(2);
    expect(matches.get(0).value).toBe('quick');
    expect(matches.get(1).value).toBe('own');
  });

  it('test_rebulk_tags_names', () => {
    const rebulk = new Rebulk();
    rebulk.string('quick', { name: 'str', tags: ['first', 'other'] });
    rebulk.regex('f.x', { tags: ['other'] as any });

    rebulk.functional((inputString: string) => {
      const i = inputString.indexOf('over');
      return i > -1 ? [i, i + 4, { tags: ['custom'] }] as any : null;
    }, { name: 'fn' });

    rebulk.functional((inputString: string) => {
      const i = inputString.indexOf('lazy');
      return i > -1 ? { start: i, end: i + 4, tags: ['custom'] } : null;
    }, { name: 'fn' });

    const matches = rebulk.matches('The quick brown fox jumps over the lazy dog');
    expect(matches.length).toBe(4);
    expect((matches.named('str') as Match[]).length).toBe(1);
    expect((matches.named('fn') as Match[]).length).toBe(2);
    expect((matches.named('false') as Match[]).length).toBe(0);
    expect((matches.tagged('false') as Match[]).length).toBe(0);
    expect((matches.tagged('first') as Match[]).length).toBe(1);
    expect((matches.tagged('other') as Match[]).length).toBe(2);
    expect((matches.tagged('custom') as Match[]).length).toBe(2);
  });

  it('test_rebulk_rules_1', () => {
    class RemoveAllButLastYear extends Rule {
      consequence = RemoveMatch;
      when(matches: Matches) {
        const entries = matches.named('year') as Match[];
        return entries.slice(0, -1);
      }
    }

    const rebulk = new Rebulk();
    rebulk.regex('\\d{4}', { name: 'year' });
    rebulk.rules(RemoveAllButLastYear);

    const matches = rebulk.matches('1984 keep only last 1968 entry 1982 case');
    expect(matches.length).toBe(1);
    expect(matches.get(0).value).toBe('1982');
  });

  it('test_rebulk_rules_2', () => {
    class PrefixedSuffixedYear extends CustomRule {
      when(matches: Matches) {
        const toRemove: Match[] = [];
        const years = matches.named('year') as Match[];
        for (const year of years) {
          const prev = matches.previous(year, (p: Match) => p.name === 'yearPrefix') as Match[];
          const next = matches.next(year, (n: Match) => n.name === 'yearSuffix') as Match[];
          if (!prev.length && !next.length) toRemove.push(year);
        }
        return toRemove;
      }
      then(matches: Matches, whenResponse: Match[]) {
        for (const m of whenResponse) matches.remove(m);
      }
    }

    const rebulk = new Rebulk();
    rebulk.regex('\\d{4}', { name: 'year' });
    rebulk.string('year', { name: 'yearPrefix', private: true });
    rebulk.string('keep', { name: 'yearSuffix', private: true });
    rebulk.rules(PrefixedSuffixedYear);

    const matches = rebulk.matches('Keep suffix 1984 keep prefixed year 1968 and remove the rest 1982');
    // Debug: check what matches remain
    // After PrivateRemover, yearPrefix and yearSuffix private matches should be gone
    // The rule should have removed 1982 (no prefix/suffix)
    expect(matches.length).toBe(2);
    expect(matches.get(0).value).toBe('1984');
    expect(matches.get(1).value).toBe('1968');
  });

  it('test_rebulk_rules_3', () => {
    class PrefixedSuffixedYearNoLambda extends Rule {
      consequence = RemoveMatch;
      when(matches: Matches) {
        const toRemove: Match[] = [];
        const years = matches.named('year') as Match[];
        for (const year of years) {
          const prev = matches.previous(year) as Match[];
          const next = matches.next(year) as Match[];
          if (!prev.filter(m => m.name === 'yearPrefix').length &&
              !next.filter(m => m.name === 'yearSuffix').length) {
            toRemove.push(year);
          }
        }
        return toRemove;
      }
    }

    const rebulk = new Rebulk();
    rebulk.regex('\\d{4}', { name: 'year' });
    rebulk.string('year', { name: 'yearPrefix', private: true });
    rebulk.string('keep', { name: 'yearSuffix', private: true });
    rebulk.rules(PrefixedSuffixedYearNoLambda);

    const matches = rebulk.matches('Keep suffix 1984 keep prefixed year 1968 and remove the rest 1982');
    expect(matches.length).toBe(2);
    expect(matches.get(0).value).toBe('1984');
    expect(matches.get(1).value).toBe('1968');
  });

  it('test_rebulk_rules_4', () => {
    class FirstOnlyRule extends Rule {
      when(matches: Matches) {
        const grabbed = matches.named('grabbed', null, 0) as Match | undefined;
        if (grabbed && (matches.previous(grabbed) as Match[]).length) return grabbed;
        return null;
      }
      then(matches: Matches, whenResponse: Match) {
        matches.remove(whenResponse);
      }
    }

    const rebulk = new Rebulk();
    rebulk.regex('This match (.*?)grabbed', { name: 'grabbed' });
    rebulk.regex("if it's (.*?)first match", { private: true });
    rebulk.rules(FirstOnlyRule);

    let matches = rebulk.matches("This match is grabbed only if it's the first match");
    expect(matches.length).toBe(1);
    expect(matches.get(0).value).toBe('This match is grabbed');

    matches = rebulk.matches("if it's NOT the first match, This match is NOT grabbed");
    expect(matches.length).toBe(0);
  });
});

describe('TestMarkers', () => {
  it('test_one_marker', () => {
    class MarkerRule extends Rule {
      when(matches: Matches) {
        const wordMatch = matches.named('word', null, 0) as Match | undefined;
        if (!wordMatch) return null;
        const marker = matches.markers.atMatch(wordMatch, (m: Match) => m.name === 'mark1', 0);
        if (!marker) return wordMatch;
        return null;
      }
      then(matches: Matches, whenResponse: Match) {
        matches.remove(whenResponse);
      }
    }

    const rebulk = new Rebulk()
      .regex('\\(.*?\\)', { marker: true, name: 'mark1' })
      .regex('\\[.*?\\]', { marker: true, name: 'mark2' })
      .string('word', { name: 'word' })
      .rules(MarkerRule);

    let matches = rebulk.matches('grab (word) only if it\'s in parenthesis');
    expect(matches.length).toBe(1);
    expect(matches.get(0).value).toBe('word');

    matches = rebulk.matches("don't grab [word] if it's in braket");
    expect(matches.length).toBe(0);

    matches = rebulk.matches("don't grab word at all");
    expect(matches.length).toBe(0);
  });

  it('test_multiple_marker', () => {
    class MarkerRule extends Rule {
      when(matches: Matches) {
        const wordMatch = matches.named('word', null, 0) as Match | undefined;
        if (!wordMatch) return null;
        const markers = matches.markers.atMatch(wordMatch, (m: Match) => m.name === 'mark1' || m.name === 'mark2') as Match[];
        if (markers.length < 2) return wordMatch;
        return null;
      }
      then(matches: Matches, whenResponse: Match) {
        matches.remove(whenResponse);
      }
    }

    const rebulk = new Rebulk()
      .regex('\\(.*?\\)', { marker: true, name: 'mark1' })
      .regex('\\[.*?\\]', { marker: true, name: 'mark2' })
      .regex('w.*?d', { name: 'word' })
      .rules(MarkerRule);

    let matches = rebulk.matches('[grab (word) only] if it\'s in parenthesis and brakets');
    expect(matches.length).toBe(1);
    expect(matches.get(0).value).toBe('word');

    matches = rebulk.matches("[don't grab](word)[if brakets are outside]");
    expect(matches.length).toBe(0);

    matches = rebulk.matches('(grab w[or)d even] if it\'s partially in parenthesis and brakets');
    expect(matches.length).toBe(1);
    expect(matches.get(0).value).toBe('w[or)d');
  });

  it('test_at_index_marker', () => {
    class MarkerRule extends Rule {
      when(matches: Matches) {
        const wordMatch = matches.named('word', null, 0) as Match | undefined;
        if (!wordMatch) return null;
        const marker = matches.markers.atIndex(wordMatch.start, (m: Match) => m.name === 'mark1', 0);
        if (!marker) return wordMatch;
        return null;
      }
      then(matches: Matches, whenResponse: Match) {
        matches.remove(whenResponse);
      }
    }

    const rebulk = new Rebulk()
      .regex('\\(.*?\\)', { marker: true, name: 'mark1' })
      .regex('w.*?d', { name: 'word' })
      .rules(MarkerRule);

    let matches = rebulk.matches('gr(ab wo)rd only if starting of match is inside parenthesis');
    expect(matches.length).toBe(1);
    expect(matches.get(0).value).toBe('wo)rd');

    matches = rebulk.matches("don't grab wo(rd if starting of match is not inside parenthesis");
    expect(matches.length).toBe(0);
  });

  it('test_remove_marker', () => {
    class MarkerRule extends Rule {
      when(matches: Matches) {
        const marker = matches.markers.named('mark1', null, 0) as Match | undefined;
        if (marker) return marker;
        return null;
      }
      then(matches: Matches, whenResponse: Match) {
        matches.markers.remove(whenResponse);
      }
    }

    const rebulk = new Rebulk()
      .regex('\\(.*?\\)', { marker: true, name: 'mark1' })
      .regex('w.*?d', { name: 'word' })
      .rules(MarkerRule);

    const matches = rebulk.matches("grab word event (if it's not) inside parenthesis");
    expect(matches.length).toBe(1);
    expect(matches.get(0).value).toBe('word');
    expect(matches.markers.length).toBe(0);
  });
});

describe('TestUnicode', () => {
  it('test_rebulk_simple', () => {
    const inputString = '敏捷的棕色狐狸跳過懶狗';
    const rebulk = new Rebulk();
    rebulk.string('敏');
    rebulk.regex('捷');
    rebulk.functional((s: string) => {
      const i = s.indexOf('的');
      return i > -1 ? [i, i + '的'.length] as [number, number] : null;
    });

    const matches = rebulk.matches(inputString);
    expect(matches.length).toBe(3);
    expect(matches.get(0).value).toBe('敏');
    expect(matches.get(1).value).toBe('捷');
    expect(matches.get(2).value).toBe('的');
  });
});

describe('TestImmutable', () => {
  it('test_starting - modifying returned list does not affect matches', () => {
    const inputString = 'The quick brown fox jumps over the lazy dog';
    const matches = new Rebulk().string('quick').string('over').string('fox').matches(inputString);

    for (let i = 0; i < inputString.length; i++) {
      const starting = matches.starting(i) as Match[];
      for (const match of [...starting]) {
        starting.splice(starting.indexOf(match), 1);
      }
    }
    expect(matches.length).toBe(3);
  });

  it('test_ending', () => {
    const inputString = 'The quick brown fox jumps over the lazy dog';
    const matches = new Rebulk().string('quick').string('over').string('fox').matches(inputString);

    for (let i = 0; i < inputString.length; i++) {
      const ending = matches.ending(i) as Match[];
      for (const match of [...ending]) {
        ending.splice(ending.indexOf(match), 1);
      }
    }
    expect(matches.length).toBe(3);
  });

  it('test_named', () => {
    const inputString = 'The quick brown fox jumps over the lazy dog';
    const matches = new Rebulk().defaults({ name: 'test' }).string('quick').string('over').string('fox').matches(inputString);

    const named = matches.named('test') as Match[];
    for (const match of [...named]) {
      named.splice(named.indexOf(match), 1);
    }
    expect(named.length).toBe(0);
    expect(matches.length).toBe(3);
  });

  it('cross-module rule priority ordering', () => {
    const order: string[] = [];

    class HighPriorityRule extends Rule {
      static override priority = 64;
      override consequence = RemoveMatch;
      when(_matches: Matches) { order.push('high'); return false; }
    }

    class LowPriorityRule extends Rule {
      static override priority = 0;
      override consequence = RemoveMatch;
      when(_matches: Matches) { order.push('low'); return false; }
    }

    const r1 = new Rebulk();
    r1.rules(LowPriorityRule); // registered first but lower priority

    const r2 = new Rebulk();
    r2.rules(HighPriorityRule); // registered second but higher priority

    const combined = new Rebulk();
    combined.rebulk(r1);
    combined.rebulk(r2);
    combined.string('test', { name: 'x' });
    combined.matches('test');

    expect(order).toEqual(['high', 'low']); // high priority runs first
  });
});
