# rebulk-js

A generic pattern matching engine for rule-based text extraction. TypeScript port of the Python [rebulk](https://github.com/Toilal/rebulk) library.

rebulk-js provides a framework for building complex text parsers using composable patterns (regex, string, functional), conflict resolution, and post-processing rules. It powers [guessit-js](https://guessit-js.2pu.net) for media filename parsing.

## Features

- **Multiple pattern types**: regex, string match, loose match, functional patterns
- **Chain patterns**: compose sequential patterns into ordered chains with repeaters
- **Conflict resolution**: automatic and custom conflict solving between overlapping matches
- **Rule engine**: post-processing rules that can add, remove, rename, or modify matches
- **Topological sorting**: rules execute in dependency order
- **Zero dependencies**: fully self-contained
- **TypeScript**: full type definitions included

## Install

```bash
npm install rebulk-js
```

## Quick Start

```typescript
import { Rebulk } from 'rebulk-js';

const rebulk = new Rebulk();

// Add regex patterns
rebulk.regex('(?<year>\\d{4})', { name: 'year', formatter: { year: (v) => parseInt(v, 10) } });
rebulk.string('HD', { name: 'quality', value: 'HD' });
rebulk.string('SD', { name: 'quality', value: 'SD' });

// Parse a string
const matches = rebulk.matches('Movie.Title.2024.HD.mkv');
const result = Object.fromEntries(matches.toDict());
console.log(result);
// { year: 2024, quality: 'HD' }
```

## Architecture

### Patterns

- **Regex patterns** (`rebulk.regex()`): Match using regular expressions with named capture groups
- **String patterns** (`rebulk.string()`): Match exact strings (case-sensitive or insensitive)
- **Functional patterns** (`rebulk.functional()`): Custom match functions returning `[start, end]` spans
- **Chain patterns** (`rebulk.chain()`): Compose multiple patterns into sequential chains with `+`, `*`, `?` repeaters

### Matches

The `Matches` container holds all matches found in a string. It provides:
- Positional queries: `atIndex()`, `atSpan()`, `range()`, `previous()`, `next()`
- Named queries: `named('property_name')`
- Hole detection: `holes()` finds unmatched regions
- Conflict detection: `conflicting()` finds overlapping matches
- Dict conversion: `toDict()` merges matches into a key-value map

### Rules

Post-processing rules run after pattern matching to refine results:
- `AppendMatch`: add new matches
- `RemoveMatch`: remove matches
- `RenameMatch`: rename match properties
- Custom rules with `when()` / `then()` lifecycle

### Conflict Resolution

When patterns produce overlapping matches, the engine resolves conflicts using:
- Longer match wins (by default)
- Custom `conflictSolver` functions per pattern
- Priority-based resolution

## API

### `new Rebulk(options?)`

Create a new rebulk instance.

### `rebulk.regex(pattern, options?)`

Register a regex pattern. Named groups become child matches.

### `rebulk.string(pattern, options?)`

Register a string match pattern.

### `rebulk.functional(fn, options?)`

Register a functional pattern. `fn(input, context)` returns `[start, end][]`.

### `rebulk.chain(options?)`

Start a chain pattern builder. Chain `.regex()`, `.string()` with `.repeater('+' | '*' | '?')`.

### `rebulk.rules(...ruleClasses)`

Register post-processing rule classes.

### `rebulk.matches(input, context?)`

Run all patterns and rules against `input`. Returns a `Matches` instance.

## License

MIT
