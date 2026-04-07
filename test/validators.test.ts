/**
 * Validator tests — port of rebulk/test/test_validators.py
 */
import { describe, it, expect } from 'vitest';
import { StringPattern } from '../src/pattern.js';
import { charsBefore, charsAfter, charsSurround, validators } from '../src/validators.js';
import type { Match } from '../src/match.js';

const chars = ' _.';
const left = (match: Match) => charsBefore(chars, match);
const right = (match: Match) => charsAfter(chars, match);
const surrounding = (match: Match) => charsSurround(chars, match);

describe('Validators', () => {
  it('test_left_chars', () => {
    let matches = new StringPattern({ validator: left }, 'word').matches('xxxwordxxx') as Match[];
    expect(matches.length).toBe(0);

    matches = new StringPattern({ validator: left }, 'word').matches('xxx_wordxxx') as Match[];
    expect(matches.length).toBe(1);

    matches = new StringPattern({ validator: left }, 'word').matches('wordxxx') as Match[];
    expect(matches.length).toBe(1);
  });

  it('test_right_chars', () => {
    let matches = new StringPattern({ validator: right }, 'word').matches('xxxwordxxx') as Match[];
    expect(matches.length).toBe(0);

    matches = new StringPattern({ validator: right }, 'word').matches('xxxword.xxx') as Match[];
    expect(matches.length).toBe(1);

    matches = new StringPattern({ validator: right }, 'word').matches('xxxword') as Match[];
    expect(matches.length).toBe(1);
  });

  it('test_surrounding_chars', () => {
    let matches = new StringPattern({ validator: surrounding }, 'word').matches('xxxword xxx') as Match[];
    expect(matches.length).toBe(0);

    matches = new StringPattern({ validator: surrounding }, 'word').matches('xxx.wordxxx') as Match[];
    expect(matches.length).toBe(0);

    matches = new StringPattern({ validator: surrounding }, 'word').matches('xxx word_xxx') as Match[];
    expect(matches.length).toBe(1);

    matches = new StringPattern({ validator: surrounding }, 'word').matches('word') as Match[];
    expect(matches.length).toBe(1);
  });

  it('test_chain', () => {
    const chained = validators(left, right);

    let matches = new StringPattern({ validator: chained }, 'word').matches('xxxword xxx') as Match[];
    expect(matches.length).toBe(0);

    matches = new StringPattern({ validator: chained }, 'word').matches('xxx.wordxxx') as Match[];
    expect(matches.length).toBe(0);

    matches = new StringPattern({ validator: chained }, 'word').matches('xxx word_xxx') as Match[];
    expect(matches.length).toBe(1);

    matches = new StringPattern({ validator: chained }, 'word').matches('word') as Match[];
    expect(matches.length).toBe(1);
  });
});
