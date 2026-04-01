# rebulk-js

A generic pattern matching engine for rule-based text extraction. TypeScript port of the Python [rebulk](https://github.com/Toilal/rebulk) library.

[![npm version](https://img.shields.io/npm/v/rebulk-js.svg)](https://www.npmjs.com/package/rebulk-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

rebulk-js provides a framework for building complex text parsers using composable patterns (regex, string, functional), conflict resolution, and post-processing rules. It powers [guessit-js](https://github.com/opensubtitles/guessit-js) for media filename parsing.

## Features

- **Multiple pattern types**: regex, string match, functional patterns
- **Chain patterns**: compose sequential patterns with `+`, `*`, `?` repeaters
- **Conflict resolution**: automatic and custom conflict solving between overlapping matches
- **Rule engine**: post-processing rules with topological dependency ordering
- **Validators & formatters**: per-match validation and value transformation
- **Markers**: metadata markers for conditional rule logic
- **Zero dependencies**: fully self-contained
- **TypeScript**: full type definitions included
- **Dual format**: ESM and CommonJS builds
- **146 tests**: full parity with the Python test suite

## Install

```bash
npm install rebulk-js
```

## Quick Start

```typescript
import { Rebulk } from 'rebulk-js';

const rebulk = new Rebulk();

// Add regex patterns with named capture groups
rebulk.regex('(?<year>\\d{4})', {
  name: 'year',
  formatter: { year: (v) => parseInt(v, 10) }
});

// String patterns with conflict resolution (longer match wins)
rebulk.string('HD', { name: 'quality', value: 'HD' });
rebulk.string('HDTV', { name: 'source', value: 'HDTV' });

// Parse a string
const matches = rebulk.matches('Movie.Title.2024.HDTV.mkv');
const result = Object.fromEntries(matches.toDict());
console.log(result);
// { year: 2024, source: 'HDTV' }
```

## Patterns

### Regex Patterns

```typescript
// Named capture groups become child matches
rebulk.regex('(?<season>\\d+)x(?<episode>\\d+)', {
  children: true,
  formatter: { season: parseInt, episode: parseInt }
});

// Python named group syntax (?P<name>...) is auto-converted
rebulk.regex('(?P<year>\\d{4})', { name: 'year' });
```

### String Patterns

```typescript
// Exact string matching (case-sensitive by default)
rebulk.string('HD', { name: 'quality', value: 'HD' });

// Case-insensitive
rebulk.stringDefaults({ ignoreCase: true });
rebulk.string('bluray', { name: 'source', value: 'BluRay' });
```

### Functional Patterns

```typescript
// Custom match function returning [start, end] spans
rebulk.functional((input) => {
  const results = [];
  const re = /\b(\d{4})\b/g;
  let m;
  while ((m = re.exec(input)) !== null) {
    results.push([m.index, m.index + m[0].length]);
  }
  return results;
}, { name: 'number' });
```

### Chain Patterns

```typescript
// Compose sequential patterns with repeaters
rebulk.chain({ children: true, privateParent: true })
  .regex('S(?<season>\\d+)')
  .regex('E(?<episode>\\d+)').repeater('+');

const matches = rebulk.matches('Show.S01E02E03.mkv');
// season: 1, episode: [2, 3]
```

## Rules

Post-processing rules run after pattern matching:

```typescript
import { Rebulk, Rule, RemoveMatch, Match } from 'rebulk-js';

class KeepOnlyLastYear extends Rule {
  consequence = RemoveMatch;

  when(matches) {
    const years = matches.named('year');
    return years.slice(0, -1); // remove all but last
  }
}

rebulk.regex('\\d{4}', { name: 'year' });
rebulk.rules(KeepOnlyLastYear);
```

### Built-in Consequences

- `RemoveMatch` — remove matches from results
- `AppendMatch` — add new matches
- `RenameMatch` — rename match properties
- `AppendTags` / `RemoveTags` — modify match tags

### Rule Dependencies

Rules execute in dependency order via topological sort:

```typescript
class RuleA extends Rule {
  static dependency = RuleB; // RuleB runs first
  // ...
}
```

## Matches API

The `Matches` container provides spatial queries:

```typescript
const matches = rebulk.matches(input);

matches.named('year')                    // by property name
matches.tagged('quality')                // by tag
matches.atIndex(pos)                     // at character position
matches.range(start, end)               // within range
matches.previous(match, predicate)       // nearest before
matches.next(match, predicate)           // nearest after
matches.holes()                          // unmatched regions
matches.conflicting(match)               // overlapping matches
matches.toDict()                         // convert to Map<string, value>
```

## Conflict Resolution

When patterns produce overlapping matches:

```typescript
// Default: longer match wins
rebulk.string('HD', { name: 'quality' });
rebulk.string('HDTV', { name: 'source' });
// "HDTV" → source: 'HDTV' (HD is removed)

// Custom conflict solver
rebulk.regex('\\d+', {
  name: 'number',
  conflictSolver: (match, conflicting) => {
    // return match to remove self, conflicting to remove other, null to skip
    return conflicting;
  }
});
```

## Composition

Combine multiple rebulk instances:

```typescript
const base = new Rebulk().regex('\\d{4}', { name: 'year' });
const quality = new Rebulk().string('HD', { name: 'quality', value: 'HD' });

const combined = new Rebulk();
combined.rebulk(base);
combined.rebulk(quality);
```

## Compatibility with Python rebulk

This is a faithful port of [Python rebulk](https://github.com/Toilal/rebulk). All 144 Python tests are ported and passing (146 total including additional JS-specific tests).

| Feature | Status |
|---------|--------|
| StringPattern | Full parity |
| RePattern | Full parity (uses ES2022 `d` flag for group indices) |
| FunctionalPattern | Full parity |
| Chain patterns | Full parity |
| Rule engine | Full parity |
| Conflict resolution | Full parity |
| Validators/formatters | Full parity |
| Markers | Full parity |
| `(?P<name>...)` syntax | Auto-converted to JS `(?<name>...)` |
| Repeated captures (`regex` module) | JS captures last repeat only (matches Python's `re` module behavior) |

## License

MIT
