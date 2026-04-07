/**
 * Processor tests — port of rebulk/test/test_processors.py
 */
import { describe, it, expect } from 'vitest';
import { StringPattern, RePattern } from '../src/pattern.js';
import { ConflictSolver } from '../src/processors.js';
import { executeRule } from '../src/rules.js';
import { Match, Matches } from '../src/match.js';

describe('ConflictSolver', () => {
  it('test_conflict_1', () => {
    const inputString = 'abcdefghijklmnopqrstuvwxyz';
    const pattern = new StringPattern({}, 'ijklmn', 'kl', 'abcdef', 'ab', 'ef', 'yz');
    const matches = new Matches(pattern.matches(inputString) as Match[]);

    executeRule(new ConflictSolver(), matches, {});

    const values = matches.toArray().map(x => x.value);
    expect(values).toEqual(['ijklmn', 'abcdef', 'yz']);
  });

  it('test_conflict_2', () => {
    const inputString = 'abcdefghijklmnopqrstuvwxyz';
    const pattern = new StringPattern({}, 'ijklmn', 'jklmnopqrst');
    const matches = new Matches(pattern.matches(inputString) as Match[]);

    executeRule(new ConflictSolver(), matches, {});

    const values = matches.toArray().map(x => x.value);
    expect(values).toEqual(['jklmnopqrst']);
  });

  it('test_conflict_3', () => {
    const inputString = 'abcdefghijklmnopqrstuvwxyz';
    const pattern = new StringPattern({}, 'ijklmnopqrst', 'jklmnopqrst');
    const matches = new Matches(pattern.matches(inputString) as Match[]);

    executeRule(new ConflictSolver(), matches, {});

    const values = matches.toArray().map(x => x.value);
    expect(values).toEqual(['ijklmnopqrst']);
  });

  it('test_conflict_4 - non-overlapping', () => {
    const inputString = '123456789';
    const pattern = new StringPattern({}, '123', '456789');
    const matches = new Matches(pattern.matches(inputString) as Match[]);

    executeRule(new ConflictSolver(), matches, {});

    const values = matches.toArray().map(x => x.value);
    expect(values).toEqual(['123', '456789']);
  });

  it('test_conflict_5 - non-overlapping', () => {
    const inputString = '123456789';
    const pattern = new StringPattern({}, '123456', '789');
    const matches = new Matches(pattern.matches(inputString) as Match[]);

    executeRule(new ConflictSolver(), matches, {});

    const values = matches.toArray().map(x => x.value);
    expect(values).toEqual(['123456', '789']);
  });

  it('test_prefer_longer_parent', () => {
    const inputString = 'xxx.1x02.xxx';

    const re1 = new RePattern({ name: 'prefer', children: true, formatter: (x: string) => parseInt(x) }, '([0-9]+)x([0-9]+)');
    const re2 = new RePattern({ name: 'skip', children: true }, 'x([0-9]+)');

    const matches = new Matches(re1.matches(inputString) as Match[]);
    matches.extend(re2.matches(inputString) as Match[]);

    executeRule(new ConflictSolver(), matches, {});
    expect(matches.length).toBe(2);
    expect(matches.get(0).value).toBe(1);
    expect(matches.get(1).value).toBe(2);
  });

  it('test_conflict_solver_1 - __default__', () => {
    const inputString = '123456789';
    const re1 = new StringPattern({ conflictSolver: () => '__default__' }, '2345678');
    const re2 = new StringPattern({}, '34567');

    const matches = new Matches(re1.matches(inputString) as Match[]);
    matches.extend(re2.matches(inputString) as Match[]);

    executeRule(new ConflictSolver(), matches, {});
    expect(matches.length).toBe(1);
    expect(matches.get(0).value).toBe('2345678');
  });

  it('test_conflict_solver_2 - reverse solver', () => {
    const inputString = '123456789';
    const re1 = new StringPattern({ conflictSolver: () => '__default__' }, '2345678');
    const re2 = new StringPattern({ conflictSolver: (_m: any, conflicting: any) => conflicting }, '34567');

    const matches = new Matches(re1.matches(inputString) as Match[]);
    matches.extend(re2.matches(inputString) as Match[]);

    executeRule(new ConflictSolver(), matches, {});
    expect(matches.length).toBe(1);
    expect(matches.get(0).value).toBe('34567');
  });

  it('test_conflict_solver_3 - self removal', () => {
    const inputString = '123456789';
    const re1 = new StringPattern({ conflictSolver: (match: any) => match }, '2345678');
    const re2 = new StringPattern({}, '34567');

    const matches = new Matches(re1.matches(inputString) as Match[]);
    matches.extend(re2.matches(inputString) as Match[]);

    executeRule(new ConflictSolver(), matches, {});
    expect(matches.length).toBe(1);
    expect(matches.get(0).value).toBe('34567');
  });

  it('test_conflict_solver_4', () => {
    const inputString = '123456789';
    const re1 = new StringPattern({}, '2345678');
    const re2 = new StringPattern({ conflictSolver: (_m: any, conflicting: any) => conflicting }, '34567');

    const matches = new Matches(re1.matches(inputString) as Match[]);
    matches.extend(re2.matches(inputString) as Match[]);

    executeRule(new ConflictSolver(), matches, {});
    expect(matches.length).toBe(1);
    expect(matches.get(0).value).toBe('34567');
  });

  it('test_conflict_solver_5', () => {
    const inputString = '123456789';
    const re1 = new StringPattern({ conflictSolver: (_m: any, conflicting: any) => conflicting }, '2345678');
    const re2 = new StringPattern({}, '34567');

    const matches = new Matches(re1.matches(inputString) as Match[]);
    matches.extend(re2.matches(inputString) as Match[]);

    executeRule(new ConflictSolver(), matches, {});
    expect(matches.length).toBe(1);
    expect(matches.get(0).value).toBe('2345678');
  });

  it('test_conflict_solver_6', () => {
    const inputString = '123456789';
    const re1 = new StringPattern({}, '2345678');
    const re2 = new StringPattern({ conflictSolver: (_m: any, conflicting: any) => conflicting }, '34567');

    const matches = new Matches(re1.matches(inputString) as Match[]);
    matches.extend(re2.matches(inputString) as Match[]);

    executeRule(new ConflictSolver(), matches, {});
    expect(matches.length).toBe(1);
    expect(matches.get(0).value).toBe('34567');
  });

  it('test_conflict_solver_7 - contained match', () => {
    const inputString = '102';
    const re1 = new StringPattern({}, '102');
    const re2 = new StringPattern({}, '02');

    const matches = new Matches(re2.matches(inputString) as Match[]);
    matches.extend(re1.matches(inputString) as Match[]);

    executeRule(new ConflictSolver(), matches, {});
    expect(matches.length).toBe(1);
    expect(matches.get(0).value).toBe('102');
  });

  it('test_unresolved', () => {
    const inputString = '123456789';

    // Equal length overlapping → both survive
    let re1 = new StringPattern({}, '23456');
    let re2 = new StringPattern({}, '34567');
    let matches = new Matches(re1.matches(inputString) as Match[]);
    matches.extend(re2.matches(inputString) as Match[]);
    executeRule(new ConflictSolver(), matches, {});
    expect(matches.length).toBe(2);

    // Custom solver returning null → unresolved
    re1 = new StringPattern({ conflictSolver: () => null }, '34567');
    re2 = new StringPattern({}, '2345678');
    matches = new Matches(re1.matches(inputString) as Match[]);
    matches.extend(re2.matches(inputString) as Match[]);
    executeRule(new ConflictSolver(), matches, {});
    expect(matches.length).toBe(2);

    // Symmetric: shorter match has conflict_solver returning null (reversed order)
    re1 = new StringPattern({ conflictSolver: () => null }, '34567');
    re2 = new StringPattern({}, '2345678');
    matches = new Matches(re2.matches(inputString) as Match[]);
    matches.extend(re1.matches(inputString) as Match[]);
    executeRule(new ConflictSolver(), matches, {});
    expect(matches.length).toBe(2);
  });
});
