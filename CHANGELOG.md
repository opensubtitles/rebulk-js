# Changelog

## 3.2.1

### Improvements

- Expanded README with full API documentation, code examples, badges, and Python compatibility table
- Added `prepublishOnly` script for safer publishes
- Added `CHANGELOG.md` and `.npmignore` to package
- Refined `files` glob patterns in package.json to exclude `index.html` from dist
- Added more keywords (guessit, media, filename) for npm discoverability

### Bug Fixes & Parity

- Added `clear()`, `insert()`, `slice()`, `setAt()`, `setSlice()`, `deleteSlice()` methods to Matches (full Python `__getitem__`/`__setitem__`/`__delitem__` parity)
- Added `toposortFlatten()` export with numeric sort matching Python's `sorted()`
- Fixed `toDict()` deduplication to use value equality (matching Python's `Match.__eq__`)
- Added `StringPattern.toString()` for debug output
- Fixed `StringPattern` to respect `start`/`end` options
- Added duplicate rule class detection (throws on duplicate, matching Python's `ValueError`)
- Ported 7 previously skipped Python tests (slice, flatten, duplicates, module loading)

## 3.2.0

Initial public release. TypeScript port of [Python rebulk](https://github.com/Toilal/rebulk) v3.2.0.

### Features

- Full port of Python rebulk pattern matching engine
- 4 pattern types: regex, string, functional, chain
- Rule engine with topological dependency ordering
- Conflict resolution (longer match wins by default, custom solvers)
- Validators, formatters, and value transformers
- Marker support for conditional rule logic
- Matches container with spatial queries (atIndex, range, previous, next, holes, conflicting)
- Chain patterns with repeaters (+, *, ?, {n,m})
- Composition via `rebulk.rebulk(other)`
- Auto-conversion of Python `(?P<name>...)` named groups to JS `(?<name>...)`
- Zero runtime dependencies
- Dual format: ESM and CommonJS
- Full TypeScript type definitions
- 146 tests (100% parity with Python test suite)

### Bug Fixes During Port

- Fixed `previous()`/`next()` methods to match Python semantics: find nearest position with any match first, then filter by predicate
- Fixed `FunctionalPattern` tuple detection for `[start, end, {opts}]` return format
- Fixed `toDict()` deduplication to use value equality (matching Python's `__eq__`) instead of identity comparison
