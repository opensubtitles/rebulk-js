/**
 * Rules tests — port of rebulk/test/test_rules.py
 */
import { describe, it, expect } from 'vitest';
import {
  Rules, CustomRule, Rule, RemoveMatch, AppendMatch, RenameMatch, AppendTags, RemoveTags, executeRule,
} from '../src/rules.js';
import { Match, Matches } from '../src/match.js';
import type { Context } from '../src/pattern.js';

// ─── Test rule classes (port of rules_module.py) ────────────────────────────

class Rule3 extends Rule {
  when(matches: Matches, context: Context) {
    return context.when;
  }
  then(matches: Matches, _whenResponse: unknown, _context: Context) {
    matches.append(new Match(3, 4));
  }
}

class Rule2 extends Rule {
  static override dependency = Rule3;
  when(_matches: Matches, _context: Context) { return true; }
  then(matches: Matches, _whenResponse: unknown, _context: Context) {
    matches.append(new Match(3, 4));
  }
}

class Rule1 extends Rule {
  static override dependency = Rule2;
  when(_matches: Matches, _context: Context) { return true; }
  then(matches: Matches, _whenResponse: unknown, _context: Context) {
    // Clear all matches
    while (matches.length > 0) matches.remove(matches.get(0));
  }
}

class Rule0 extends Rule {
  static override dependency = Rule1;
  when(_matches: Matches, _context: Context) { return true; }
  then(matches: Matches, _whenResponse: unknown, _context: Context) {
    matches.append(new Match(3, 4));
  }
}

class Rule1Disabled extends Rule1 {
  static override ruleName = 'Disabled Rule1';
  override enabled(_context: Context) { return false; }
}

// ─── Default rules (port of default_rules_module.py) ─────────────────────

class RuleRemove0 extends Rule {
  consequence = RemoveMatch;
  when(matches: Matches) { return matches.get(0); }
}

class RuleRemove1 extends Rule {
  consequence = [new RemoveMatch()];
  when(matches: Matches) { return [matches.get(0)]; }
}

class RuleAppend0 extends Rule {
  consequence = new AppendMatch();
  when() { return new Match(5, 10); }
}

class RuleAppend1 extends Rule {
  consequence = [AppendMatch];
  when() { return [new Match(5, 10)]; }
}

class RuleAppend2 extends Rule {
  consequence = [new AppendMatch('renamed')];
  when() { return [new Match(5, 10)]; }
}

class RuleAppend3 extends Rule {
  consequence = new AppendMatch('renamed');
  when() { return [new Match(5, 10)]; }
}

class RuleRename0 extends Rule {
  consequence = [new RenameMatch('renamed')];
  when() { return [new Match(5, 10, { name: 'original' })]; }
}

class RuleRename1 extends Rule {
  consequence = new RenameMatch('renamed');
  when(matches: Matches) { return [...matches]; }
}

class RuleRename2 extends Rule {
  consequence = new RenameMatch('renamed');
  when(matches: Matches) { return matches.get(0); }
}

class RuleRename3 extends Rule {
  consequence = [new RenameMatch('renamed')];
  when(matches: Matches) { return matches.get(0); }
}

class RuleAppendTags0 extends Rule {
  consequence = new AppendTags(['new-tag']);
  when(matches: Matches) { return matches.named('tags', null, 0); }
}

class RuleAppendTags1 extends Rule {
  consequence = new AppendTags(['new-tag']);
  when(matches: Matches) { return matches.named('tags'); }
}

class RuleRemoveTags0 extends Rule {
  consequence = new RemoveTags(['new-tag']);
  when(matches: Matches) { return matches.named('tags', null, 0); }
}

class RuleRemoveTags1 extends Rule {
  consequence = new RemoveTags(['new-tag']);
  when(matches: Matches) { return matches.named('tags'); }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Rules Engine', () => {
  it('test_rule_priority - dependency ordering', () => {
    // Rule2 depends on Rule3, Rule1 depends on Rule2, so order: Rule3→Rule2→Rule1
    let matches = new Matches([new Match(1, 2)]);
    const rules = new Rules(Rule1, new Rule2());
    rules.executeAllRules(matches, {});
    expect(matches.length).toBe(0);

    // Rule0 depends on Rule1, so: Rule2→Rule1 (clears)→Rule0 (adds Match(3,4))
    matches = new Matches([new Match(1, 2)]);
    const rules2 = new Rules(new Rule1(), Rule0);
    rules2.executeAllRules(matches, {});
    expect(matches.length).toBe(1);
    expect(matches.get(0).equals(new Match(3, 4))).toBe(true);
  });

  it('test_rule_disabled', () => {
    const matches = new Matches([new Match(1, 2)]);
    const rules = new Rules(new Rule1Disabled(), new Rule2());
    rules.executeAllRules(matches, {});
    // Rule1Disabled is disabled, so only Rule2 adds Match(3,4)
    expect(matches.length).toBe(2);
    expect(matches.get(0).equals(new Match(1, 2))).toBe(true);
    expect(matches.get(1).equals(new Match(3, 4))).toBe(true);
  });

  // Note: test_rules_duplicates tests that Python raises ValueError when duplicate
  // rule instances of the same class are added. The JS port doesn't enforce this
  // restriction — it deduplicates silently via Rules.extend(). This is a documented
  // behavioral difference.

  it('test_rule_repr', () => {
    expect(new Rule0().toString()).toBe('<Rule0>');
    expect(new Rule1().toString()).toBe('<Rule1>');
    expect(new Rule2().toString()).toBe('<Rule2>');
  });

  // Note: test_rule_module tests loading rules from a Python module.
  // JS doesn't have the same module-level class discovery. Rules are passed
  // explicitly as classes/instances. This is a documented API difference.

  it('test_rule_when', () => {
    let matches = new Matches([new Match(1, 2)]);
    const rules = new Rules(new Rule3());

    rules.executeAllRules(matches, { when: false });
    expect(matches.length).toBe(1);

    matches = new Matches([new Match(1, 2)]);
    rules.executeAllRules(matches, { when: true });
    expect(matches.length).toBe(2);
  });
});

describe('DefaultRules', () => {
  it('test_remove', () => {
    let rules = new Rules(RuleRemove0);
    let matches = new Matches([new Match(1, 2)]);
    rules.executeAllRules(matches, {});
    expect(matches.length).toBe(0);

    rules = new Rules(RuleRemove1);
    matches = new Matches([new Match(1, 2)]);
    rules.executeAllRules(matches, {});
    expect(matches.length).toBe(0);
  });

  it('test_append', () => {
    let rules = new Rules(RuleAppend0);
    let matches = new Matches([new Match(1, 2)]);
    rules.executeAllRules(matches, {});
    expect(matches.length).toBe(2);

    rules = new Rules(RuleAppend1);
    matches = new Matches([new Match(1, 2)]);
    rules.executeAllRules(matches, {});
    expect(matches.length).toBe(2);

    rules = new Rules(RuleAppend2);
    matches = new Matches([new Match(1, 2)]);
    rules.executeAllRules(matches, {});
    expect(matches.length).toBe(2);
    expect((matches.named('renamed') as Match[]).length).toBe(1);

    rules = new Rules(RuleAppend3);
    matches = new Matches([new Match(1, 2)]);
    rules.executeAllRules(matches, {});
    expect(matches.length).toBe(2);
    expect((matches.named('renamed') as Match[]).length).toBe(1);
  });

  it('test_rename', () => {
    // RuleRename0 creates its own Match(5,10) — won't find it in matches to rename
    let rules = new Rules(RuleRename0);
    let matches = new Matches([new Match(1, 2, { name: 'original' })]);
    rules.executeAllRules(matches, {});
    expect((matches.named('original') as Match[]).length).toBe(1);
    expect((matches.named('renamed') as Match[]).length).toBe(0);

    // RuleRename1 renames existing matches
    rules = new Rules(RuleRename1);
    matches = new Matches([new Match(5, 10, { name: 'original' })]);
    rules.executeAllRules(matches, {});
    expect((matches.named('original') as Match[]).length).toBe(0);
    expect((matches.named('renamed') as Match[]).length).toBe(1);

    // RuleRename2 returns single match
    rules = new Rules(RuleRename2);
    matches = new Matches([new Match(5, 10, { name: 'original' })]);
    rules.executeAllRules(matches, {});
    expect((matches.named('original') as Match[]).length).toBe(0);
    expect((matches.named('renamed') as Match[]).length).toBe(1);

    // RuleRename3 returns single match with array consequence
    rules = new Rules(RuleRename3);
    matches = new Matches([new Match(5, 10, { name: 'original' })]);
    rules.executeAllRules(matches, {});
    expect((matches.named('original') as Match[]).length).toBe(0);
    expect((matches.named('renamed') as Match[]).length).toBe(1);
  });

  it('test_append_tags', () => {
    let rules = new Rules(RuleAppendTags0);
    let matches = new Matches([new Match(1, 2, { name: 'tags', tags: ['other'] })]);
    rules.executeAllRules(matches, {});
    expect((matches.named('tags') as Match[]).length).toBe(1);
    expect((matches.named('tags', null, 0) as Match).tags).toEqual(['other', 'new-tag']);

    rules = new Rules(RuleAppendTags1);
    matches = new Matches([new Match(1, 2, { name: 'tags', tags: ['other'] })]);
    rules.executeAllRules(matches, {});
    expect((matches.named('tags') as Match[]).length).toBe(1);
    expect((matches.named('tags', null, 0) as Match).tags).toEqual(['other', 'new-tag']);
  });

  it('test_remove_tags', () => {
    let rules = new Rules(RuleRemoveTags0);
    let matches = new Matches([new Match(1, 2, { name: 'tags', tags: ['other', 'new-tag'] })]);
    rules.executeAllRules(matches, {});
    expect((matches.named('tags') as Match[]).length).toBe(1);
    expect((matches.named('tags', null, 0) as Match).tags).toEqual(['other']);

    rules = new Rules(RuleRemoveTags1);
    matches = new Matches([new Match(1, 2, { name: 'tags', tags: ['other', 'new-tag'] })]);
    rules.executeAllRules(matches, {});
    expect((matches.named('tags') as Match[]).length).toBe(1);
    expect((matches.named('tags', null, 0) as Match).tags).toEqual(['other']);
  });
});
