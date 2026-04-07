# Python rebulk → JS Port Gaps

Tracking file for remaining differences between Python rebulk and rebulk-js.

## Gap 1: `loose.call()` cannot filter keyword arguments
- **Python**: `call(fn, *args, **kwargs)` introspects function signatures, strips unsupported kwargs
- **JS**: `call()` trims positional args by `Function.length` but cannot filter object-style options
- **Used in**: FunctionalPattern._match (user fns may not accept context arg)
- **Impact**: In JS, functions silently accept extra positional args. The only real-world issue is
  if a user function throws on extra args, which is extremely rare in JS. The `call()` implementation
  trims positional args to `Function.length` which handles the main use case.
- **Status**: FIXED (as close as JS allows) — `call()` implemented with Function.length trimming.
  True Python-style kwargs filtering is impossible in JS because JS has no `**kwargs` concept.

## Gap 2: `Match.__hash__` / value-equality in Sets and lists
- **Python**: `__hash__` on Match enables dedup in sets. `__eq__` used by `in` operator on lists.
- **JS**: No `__hash__`. `Set` uses reference equality.
- **Mitigation**: `Matches.includes()` now uses `m.equals()` for value-equality (matching Python's
  `__contains__` → `__eq__`). `toDict()` uses `valEquals()` for Match dedup. `IdentitySet` is used
  where identity semantics are needed (ConflictSolver).
- **Status**: FIXED — `includes()` uses `.equals()`, `toDict()` uses match equality.
  Native `Set<Match>` still uses reference equality, but rebulk code doesn't rely on it.

## Gap 3: `Matches.slice()` returns `Match[]` not `Matches`
- **Status**: FIXED — `slice()` now returns `Matches` container.

## Gap 4: `Rules.load_module()` not implemented
- **Status**: FIXED — `loadModule()` scans an object's values for CustomRule subclasses.
  `load()` auto-detects module-like objects (plain objects that aren't CustomRule instances).

## Gap 5: `ConflictSolver` had extra sibling removal logic
- **Python**: No sibling removal in ConflictSolver
- **Status**: FIXED — Removed JS-only sibling removal logic. Also removed custom `then()` override
  so ConflictSolver now uses standard `Rule.then()` dispatch like Python.

## Gap 6: `filterMatchKwargs` used different strategy
- **Python**: Blocklist of 6 keys (`pattern`, `start`, `end`, `parent`, `formatter`, `value`)
- **Status**: FIXED — Now uses Python's exact blocklist approach.

## Gap 7: Python test assertions completeness
- All Python test function names are ported 1:1 to JS.
- Python `test_to_dict` had extra `values_list` assertions in details mode — now added.
- Added `range()` tests to `test_base`.
- Added `instanceof Matches` check to `test_get_slices`.
- Added starting/ending lookups to `test_constructor_kwargs`.
- Added raw_start/raw_end reset assertions to `test_raw`.
- Added chain_before/chain_after with Match objects and end param to `test_chains`.
- Added span/name/value assertions to `test_parent_children_private` and `test_every`.
- Added third unresolved block to processors `test_unresolved`.
- Rewrote debug tests with full end-to-end integration (Pattern, Match, Rule, Rebulk defined_at).
- **Status**: FIXED — all Python test methods present, assertions aligned.

## Gap 8: `Match.value` edge case with `0`/`false`/`''`
- **Status**: FIXED — Uses truthy check matching Python. Test `test_value_falsy` added.

## Gap 9: `holes()` implementation details differ
- **Python**: `_hole_start` scans backward, returns FIRST found (nearest to position).
  `_hole_end` scans forward from position.
- **Status**: FIXED — `loopStart` calculation now breaks on first found (matching Python).
  Trailing hole end calculation now uses `starting()` like Python's `_hole_end`.

## Gap 10: `Match.split()` logic differs
- **Python**: Uses deepcopy + split_match/current_match tracking
- **JS**: Uses integer tracking + clone
- **Status**: VERIFIED — Different implementation style but equivalent behavior.
  Both handle leading/trailing separators correctly. JS `_clone()` matches Python's `deepcopy`.

## Remaining JS language limitations (unfixable)

These are inherent JS/Python language differences that cannot be bridged:

1. **No `__hash__`**: JS objects cannot customize how they behave in `Set` or `Map`.
   Mitigated by using `.equals()` explicitly in all comparison paths.

2. **No `**kwargs`**: JS functions don't have keyword arguments. `loose.call()` can trim
   positional args but not filter named options from an options object.
   Mitigated: not needed because JS patterns pass options as structured objects.

3. **No operator overloading**: `match1 == match2` uses reference equality in JS.
   `match1.equals(match2)` must be used explicitly. All internal code does this.

4. **No module introspection**: Python's `inspect.getmembers(module)` scans a module's exports.
   Mitigated: `Rules.loadModule()` scans an object's values, which covers the JS equivalent
   (`import * as module from '...'` produces such an object).
