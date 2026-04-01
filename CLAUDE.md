# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TypeScript port of the Python [rebulk](https://github.com/Toilal/rebulk) library — a generic pattern matching engine for rule-based text extraction. Powers [guessit-js](https://guessit-js.2pu.net) for media filename parsing. Zero runtime dependencies.

## Commands

- **Build**: `npm run build` (runs `tsc --noEmit` then `vite build`, outputs to `dist/`)
- **Typecheck only**: `npm run typecheck`
- **Run all tests**: `npm run test`
- **Run single test**: `npx vitest run test/rebulk.test.ts` (or use `-t "test name"` to filter)
- **Watch mode**: `npm run test:watch`

## Architecture

This is a port of the Python rebulk library. Each `src/*.ts` file maps to a Python module (`rebulk/*.py`). The port preserves the Python API structure closely.

### Core Pipeline

`Rebulk.matches(input)` runs two phases:
1. **Pattern matching** — each registered pattern (`RePattern`, `StringPattern`, `FunctionalPattern`, or `Chain`) runs against the input string, producing `Match` objects
2. **Rule execution** — post-processing rules (topologically sorted by dependency, grouped by priority) refine results via `when()`/`then()` lifecycle

### Key Classes

- **`Rebulk`** (`rebulk.ts`) extends `Builder` — top-level entry point. Holds patterns, rules, and child rebulk instances. Composable via `rebulk.rebulk(childRebulk)`.
- **`Builder`** (`builder.ts`) — fluent API for registering patterns with defaults. Supports `regex()`, `string()`, `functional()`, `chain()`.
- **`Pattern`** (`pattern.ts`) — base pattern class with match post-processing (validation, formatting, children extraction, private marking). `RePattern`, `StringPattern`, `FunctionalPattern` extend it.
- **`Chain`** (`chain.ts`) — sequential pattern composition with repeaters (`+`, `*`, `?`, `{n,m}`). Each `ChainPart` wraps a pattern. Uses `_chainBridge.ts` to avoid circular imports with `builder.ts`.
- **`Match` / `Matches`** (`match.ts`) — match objects with span/value/name/tags and a container with lazy index caches (by name, tag, start, end, position). `Matches` provides spatial queries (`atIndex`, `holes`, `conflicting`, `previous`, `next`, `chainBefore/After`).
- **`Rules`** (`rules.ts`) — rule engine with `CustomRule` base class, built-in consequences (`RemoveMatch`, `AppendMatch`, `RenameMatch`, `AppendTags`, `RemoveTags`), and topological sort for dependency ordering.
- **`ConflictSolver` / `PrivateRemover`** (`processors.ts`) — default rules loaded automatically. ConflictSolver resolves overlapping matches (longer wins). PrivateRemover strips private matches after processing.

### Build Output

Dual format library (ESM + CJS) built with Vite. Entry point is `src/index.ts` which re-exports everything from `src/rebulk.ts`. Type declarations generated via `vite-plugin-dts`.

### Path Alias

`@/*` maps to `./src/*` in both `tsconfig.json` and Vite configs.
