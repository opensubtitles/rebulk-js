# Changelog

## Unreleased

- **Chain matching is no longer quadratic in the input length.** `Chain._match`
  walks the input one offset at a time and handed each attempt the entire rest of
  the string, but `ChainPart._truncateRepeater` keeps only the matches running
  contiguously from the start of that slice — so nearly every scan was discarded
  work, and the walk cost O(offsets x remaining length).

  Each attempt now sees a bounded window, and when a window holds no chain the
  walk slides on (with overlap) instead of giving up on the rest of the input,
  which is what the old `break` did once a scan reached the end.

  Measured on a guessit-js season/episode chain: four times the input took 15.2x
  the time before, 4x after. A 2800-character name went from 2308 ms to 425 ms;
  an ordinary name is unchanged at well under 3 ms. Existing behaviour is
  unchanged — guessit-js parses all 1470 corpus names to byte-identical results,
  and `test/chain-scaling.test.ts` pins both the complexity class and the
  discovery of chains lying far beyond the first window.

## 3.4.0

Engine fixes found while porting guessit 4.x rules in guessit-js:

- **Duplicate rule classes are allowed and all instances execute.** Python rebulk
  raises on duplicates and its Rules container silently dedupes by class — which
  makes guessit's own `RemoveLessSpecificSeasonEpisode("season")/("episode")`
  registration lose an instance. rebulk-js now runs every instance; a class
  dependency resolves to all instances of that class.
- **`Matches.matches` getter** returning the match array. Ported Python code
  reads `matches.matches`; previously that evaluated to `undefined` and turned
  rule bodies into silent no-ops.
- CI + tag-triggered npm trusted-publishing workflows added.

## 3.3.1

Cleanup and performance improvements. No API changes.

- Removed dead code: unused `getFirstDefined` duplicate and unused `isIterable` import in `loose.ts`
- Performance: `conflicting()` uses `Set` for O(1) dedup instead of `Array.includes()` O(n)
- Performance: removed unnecessary array spreads in `named()`, `tagged()`, `starting()`, `ending()`, `atIndex()`
- Deleted 13 leftover empty test artifact files from Python port
- Added `*.tgz` to `.gitignore`

## 3.3.0

Full 1:1 Python rebulk parity release. Matches Python rebulk v3.3.0 feature-for-feature.

### New Modules

- **`debug.ts`** — Debug tools: `DEBUG` flag, `LOG_LEVEL`, `Frame`, `definedAt()`, `frameRepr()`. Patterns, Matches, and Rules now track their definition location when `DEBUG=true`.
- **`introspector.ts`** — Pattern/rule introspection: `Introspection`, `PatternDescription`, `RuleDescription`, `introspect()`. Analyzes a Rebulk instance to discover what properties it can produce.
- **`validators()` chain function** — Chain multiple validators into one (all must pass).
- **`loose.call()`** — Loose function calling that trims positional args to `Function.length`.

### Source Code Fixes (Python Parity)

- **`Match.value` getter** uses truthy check matching Python (`0`, `false`, `''` fall through to formatter/raw)
- **`Match.toString()`** now uses Python format `<value:(start, end)+flags>` with initiator and defined_at info
- **`Match.defined_at`** tracks definition location (from pattern or call site when `DEBUG=true`)
- **`Pattern.defined_at`** tracks where patterns were created
- **`CustomRule.defined_at`** tracks where rules were created
- **`next()`** starts at `match.start + 1` matching Python (was `match.end`)
- **`previous()`/`next()`** find nearest match group first, then filter by predicate (matching Python)
- **`Matches.includes()`** uses `match.equals()` for value equality (matching Python `__contains__` → `__eq__`)
- **`Matches.slice()`** returns `Matches` container (matching Python `__getitem__` with slice)
- **`filterMatchKwargs`** now uses Python's exact 6-key blocklist approach
- **`ConflictSolver`** removed JS-only sibling removal logic and custom `then()` override; now uses standard `Rule.then()` dispatch like Python
- **`Chain._processMatch`** override added — fallback validation by removing trailing chain parts (matching Python)
- **`Rules.loadModule()`** scans an object's values for CustomRule subclasses (Python module introspection equivalent)
- **`Rules.load()`** auto-detects module-like objects, class constructors, and instances
- **`toposortRules`** duplicate class detection moved here from `executeAllRules` (matching Python)
- **`holes()`** loopStart calculation fixed to break on first found match (matching Python `_hole_start`)
- **`ensureDict`** fixed to match Python's falsy-first-then-promote logic
- **`toposortFlatten`** added and exported
- Fixed self-referencing import (`rebulk-js` → `./loose.js`)

### New Tests (169 total, 754 assertions)

- **`test/validators.test.ts`** (4 tests) — charsBefore, charsAfter, charsSurround, validators chain
- **`test/debug.test.ts`** (7 tests) — End-to-end debug integration: Pattern, Match, Rule, Rebulk defined_at tracking
- **`test/introspector.test.ts`** (4 tests) — String/regex/functional pattern introspection, rule properties
- **`test/loose.test.ts`** (6 tests) — ensureList, ensureDict, filterIndex, setDefaults
- **`test/toposort.test.ts`** +1 test — test_objects with non-primitive keys
- Added missing Python assertions across all existing test files: range(), chain_before/after with Match objects, raw_start/raw_end reset, pattern.name checks, validate_all first scenario, named("false")/tagged("false"), slice instanceof check, unresolved symmetric case

### Exports

- Added: `call`, `validators`, `toposortRules`, `CyclicDependency`, `DEBUG`, `LOG_LEVEL`, `setDebug`, `setLogLevel`, `definedAt`, `frameRepr`, `Frame`, `Introspection`, `PatternDescription`, `RuleDescription`, `Description`, `introspect`

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
