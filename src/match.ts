/**
 * Match, Matches, Markers — port of rebulk/match.py
 */
import { ensureList, filterIndex } from './loose.js';
import type { FormatterFn } from './formatters.js';
import type { ValidatorFn } from './validators.js';
import type { BasePattern } from './pattern.js';

export type ConflictSolverFn = (match: Match, conflicting: Match) => Match | null | '__default__';

export interface MatchOptions {
  name?: string;
  tags?: string | string[];
  marker?: boolean;
  private?: boolean;
  inputString?: string;
  formatter?: FormatterFn | Record<string, FormatterFn>;
  value?: unknown;
  conflictSolver?: ConflictSolverFn;
  pattern?: BasePattern;
  parent?: Match;
}

// ─── Match ───────────────────────────────────────────────────────────────────

export class Match {
  start: number;
  end: number;
  name: string | undefined;
  tags: string[];
  marker: boolean;
  private: boolean;
  inputString: string | undefined;
  formatter: FormatterFn | Record<string, FormatterFn> | undefined;
  pattern: BasePattern | undefined;
  parent: Match | undefined;
  conflictSolver: ConflictSolverFn | undefined;
  /** Index within the sequence of matches produced by the same pattern. */
  matchIndex = 0;

  private _value: unknown;
  private _children: Matches | undefined;
  private _rawStart: number | undefined;
  private _rawEnd: number | undefined;

  constructor(start: number, end: number, opts: MatchOptions = {}) {
    this.start = start;
    this.end = end;
    this.name = opts.name;
    this.tags = ensureList(opts.tags) as string[];
    this.marker = opts.marker ?? false;
    this.private = opts.private ?? false;
    this.inputString = opts.inputString;
    this.formatter = opts.formatter;
    this._value = opts.value;
    this.conflictSolver = opts.conflictSolver;
    this.pattern = opts.pattern;
    this.parent = opts.parent;
  }

  get span(): [number, number] {
    return [this.start, this.end];
  }

  get rawStart(): number {
    return this._rawStart !== undefined ? this._rawStart : this.start;
  }
  set rawStart(v: number) {
    this._rawStart = v;
  }

  get rawEnd(): number {
    return this._rawEnd !== undefined ? this._rawEnd : this.end;
  }
  set rawEnd(v: number) {
    this._rawEnd = v;
  }

  get raw(): string | undefined {
    if (this.inputString !== undefined) {
      return this.inputString.slice(this.rawStart, this.rawEnd);
    }
    return undefined;
  }

  get value(): unknown {
    if (this._value !== undefined && this._value !== null) return this._value;
    if (this.formatter && typeof this.formatter === 'function') return this.formatter(this.raw ?? '');
    return this.raw;
  }

  set value(v: unknown) {
    this._value = v;
  }

  get children(): Matches {
    if (!this._children) {
      this._children = new Matches(undefined, this.inputString);
    }
    return this._children;
  }

  set children(v: Matches) {
    this._children = v;
  }

  /** All property names in this match (recursing into children). */
  get names(): Set<string> {
    if (!this._children || this._children.length === 0) {
      return this.name ? new Set([this.name]) : new Set();
    }
    const ret = new Set<string>();
    for (const child of this._children) {
      for (const n of child.names) ret.add(n);
    }
    return ret;
  }

  /** Walk up to the root (top-most parent). */
  get initiator(): Match {
    let m: Match = this;
    while (m.parent) m = m.parent;
    return m;
  }

  get length(): number {
    return this.end - this.start;
  }

  /** Check if this match has at least one of the given tags. */
  tagged(...tags: string[]): boolean {
    return tags.some((t) => this.tags.includes(t));
  }

  /** Check if any child (recursive) has one of the given names. */
  named(...names: string[]): boolean {
    return names.some((n) => this.names.has(n));
  }

  /**
   * Crop this match with the given spans/matches.
   * Returns a list of Match fragments after subtracting the crop regions.
   */
  crop(crops: Match | [number, number] | Array<Match | [number, number]>, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined {
    const cropsArr: Array<Match | [number, number]> = Array.isArray(crops) && crops.length === 2 && typeof crops[0] === 'number'
      ? [crops as [number, number]]
      : Array.isArray(crops)
        ? crops as Array<Match | [number, number]>
        : [crops as Match];

    const initial = this._clone();
    let ret: Match[] = [initial];

    for (const crop of cropsArr) {
      const [cStart, cEnd] = 'span' in (crop as Match) ? (crop as Match).span : crop as [number, number];
      for (const current of [...ret]) {
        if (cStart <= current.start && cEnd >= current.end) {
          ret.splice(ret.indexOf(current), 1);
        } else if (cStart >= current.start && cEnd <= current.end) {
          const right = current._clone();
          current.end = cStart;
          if (current.length === 0) ret.splice(ret.indexOf(current), 1);
          right.start = cEnd;
          if (right.length > 0) ret.push(right);
        } else if (current.end >= cEnd && cEnd > current.start) {
          current.start = cEnd;
        } else if (current.start <= cStart && cStart < current.end) {
          current.end = cStart;
        }
      }
    }

    return filterIndex(ret, predicate ?? null, index ?? null) as Match[] | Match | undefined;
  }

  /**
   * Split this match into multiple matches at each separator character.
   */
  split(seps: string, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined {
    const ret: Match[] = [];
    let currentStart: number | null = null;

    for (let i = 0; i < (this.raw?.length ?? 0); i++) {
      const char = this.raw![i];
      if (seps.includes(char)) {
        if (currentStart !== null) {
          const m = this._clone();
          m.start = this.start + currentStart;
          m.end = this.start + i;
          ret.push(m);
          currentStart = null;
        }
      } else {
        if (currentStart === null) currentStart = i;
      }
    }
    if (currentStart !== null) {
      const m = this._clone();
      m.start = this.start + currentStart;
      // end stays at this.end
      ret.push(m);
    }

    return filterIndex(ret, predicate ?? null, index ?? null) as Match[] | Match | undefined;
  }

  clone(): Match {
    return this._clone();
  }

  private _clone(): Match {
    const m = new Match(this.start, this.end, {
      name: this.name,
      tags: [...this.tags],
      marker: this.marker,
      private: this.private,
      inputString: this.inputString,
      formatter: this.formatter,
      value: this._value,
      conflictSolver: this.conflictSolver,
      pattern: this.pattern,
      parent: this.parent,
    });
    m.matchIndex = this.matchIndex;
    m._rawStart = this._rawStart;
    m._rawEnd = this._rawEnd;
    return m;
  }

  /** Equality by span, value, name, parent identity. */
  equals(other: Match): boolean {
    return (
      this.start === other.start &&
      this.end === other.end &&
      this.value === other.value &&
      this.name === other.name &&
      this.parent === other.parent
    );
  }

  toString(): string {
    const flags = this.private ? '+private' : '';
    const name = this.name ? `+name=${this.name}` : '';
    const tags = this.tags.length ? `+tags=${JSON.stringify(this.tags)}` : '';
    return `<${String(this.value)}:${JSON.stringify(this.span)}${flags}${name}${tags}>`;
  }
}

// ─── MatchesDict ─────────────────────────────────────────────────────────────

export class MatchesDict extends Map<string, unknown> {
  /** Keyed by property name → all Match objects for that name. */
  readonly matches: Map<string, Match[]> = new Map();
  /** Keyed by property name → unique values (de-duped). */
  readonly valuesList: Map<string, unknown[]> = new Map();
}

// ─── _BaseMatches ─────────────────────────────────────────────────────────────

/** Internal base class for Matches and Markers. */
export class _BaseMatches {
  inputString: string | undefined;
  protected _delegate: Match[] = [];
  protected _maxEnd = 0;

  // Lazy lookup caches (null = not yet built)
  protected _nameDict: Map<string, Match[]> | null = null;
  protected _tagDict: Map<string, Match[]> | null = null;
  protected _startDict: Map<number, Match[]> | null = null;
  protected _endDict: Map<number, Match[]> | null = null;
  protected _indexDict: Map<number, Match[]> | null = null;

  constructor(matches?: Match[] | null, inputString?: string) {
    this.inputString = inputString;
    if (matches) this.extend(matches);
  }

  get length(): number { return this._delegate.length; }

  [Symbol.iterator](): Iterator<Match> {
    return this._delegate[Symbol.iterator]();
  }

  toArray(): Match[] { return [...this._delegate]; }

  // ── Cache accessors ──────────────────────────────────────────────────────

  get nameDict(): Map<string, Match[]> {
    if (!this._nameDict) {
      this._nameDict = new Map();
      for (const m of this._delegate) {
        if (m.name) {
          const arr = this._nameDict.get(m.name) ?? [];
          arr.push(m);
          this._nameDict.set(m.name, arr);
        }
      }
    }
    return this._nameDict;
  }

  get startDict(): Map<number, Match[]> {
    if (!this._startDict) {
      this._startDict = new Map();
      for (const m of this._delegate) {
        const arr = this._startDict.get(m.start) ?? [];
        arr.push(m);
        this._startDict.set(m.start, arr);
      }
    }
    return this._startDict;
  }

  get endDict(): Map<number, Match[]> {
    if (!this._endDict) {
      this._endDict = new Map();
      for (const m of this._delegate) {
        const arr = this._endDict.get(m.end) ?? [];
        arr.push(m);
        this._endDict.set(m.end, arr);
      }
    }
    return this._endDict;
  }

  get tagDict(): Map<string, Match[]> {
    if (!this._tagDict) {
      this._tagDict = new Map();
      for (const m of this._delegate) {
        for (const tag of m.tags) {
          const arr = this._tagDict.get(tag) ?? [];
          arr.push(m);
          this._tagDict.set(tag, arr);
        }
      }
    }
    return this._tagDict;
  }

  get indexDict(): Map<number, Match[]> {
    if (!this._indexDict) {
      this._indexDict = new Map();
      for (const m of this._delegate) {
        for (let i = m.start; i < m.end; i++) {
          const arr = this._indexDict.get(i) ?? [];
          arr.push(m);
          this._indexDict.set(i, arr);
        }
      }
    }
    return this._indexDict;
  }

  get maxEnd(): number {
    return this.inputString
      ? Math.max(this.inputString.length, this._maxEnd)
      : this._maxEnd;
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  protected _addMatch(match: Match): void {
    if (this._nameDict && match.name) {
      const arr = this._nameDict.get(match.name) ?? [];
      arr.push(match);
      this._nameDict.set(match.name, arr);
    }
    if (this._tagDict) {
      for (const tag of match.tags) {
        const arr = this._tagDict.get(tag) ?? [];
        arr.push(match);
        this._tagDict.set(tag, arr);
      }
    }
    if (this._startDict) {
      const arr = this._startDict.get(match.start) ?? [];
      arr.push(match);
      this._startDict.set(match.start, arr);
    }
    if (this._endDict) {
      const arr = this._endDict.get(match.end) ?? [];
      arr.push(match);
      this._endDict.set(match.end, arr);
    }
    if (this._indexDict) {
      for (let i = match.start; i < match.end; i++) {
        const arr = this._indexDict.get(i) ?? [];
        arr.push(match);
        this._indexDict.set(i, arr);
      }
    }
    if (match.end > this._maxEnd) this._maxEnd = match.end;
  }

  protected _removeMatch(match: Match): void {
    if (this._nameDict && match.name) {
      const arr = this._nameDict.get(match.name);
      if (arr) {
        const idx = arr.findIndex((m) => m === match);
        if (idx !== -1) arr.splice(idx, 1);
      }
    }
    if (this._tagDict) {
      for (const tag of match.tags) {
        const arr = this._tagDict.get(tag);
        if (arr) {
          const idx = arr.findIndex((m) => m === match);
          if (idx !== -1) arr.splice(idx, 1);
        }
      }
    }
    if (this._startDict) {
      const arr = this._startDict.get(match.start);
      if (arr) {
        const idx = arr.findIndex((m) => m === match);
        if (idx !== -1) arr.splice(idx, 1);
      }
    }
    if (this._endDict) {
      const arr = this._endDict.get(match.end);
      if (arr) {
        const idx = arr.findIndex((m) => m === match);
        if (idx !== -1) arr.splice(idx, 1);
      }
    }
    if (this._indexDict) {
      for (let i = match.start; i < match.end; i++) {
        const arr = this._indexDict.get(i);
        if (arr) {
          const idx = arr.findIndex((m) => m === match);
          if (idx !== -1) arr.splice(idx, 1);
        }
      }
    }
    // Recalculate _maxEnd if necessary
    if (match.end >= this._maxEnd) {
      this._maxEnd = 0;
      for (const m of this._delegate) {
        if (m.end > this._maxEnd) this._maxEnd = m.end;
      }
    }
  }

  append(match: Match): void {
    this._delegate.push(match);
    this._addMatch(match);
  }

  extend(matches: Match[]): void {
    for (const m of matches) this.append(m);
  }

  remove(match: Match): void {
    const idx = this._delegate.findIndex((m) => m === match);
    if (idx !== -1) {
      this._delegate.splice(idx, 1);
      this._removeMatch(match);
    }
  }

  includes(match: Match): boolean {
    return this._delegate.some((m) => m === match);
  }

  at(index: number): Match | undefined {
    return this._delegate[index];
  }

  get(index: number): Match {
    return this._delegate[index];
  }

  sort(): Match[] {
    return [...this._delegate].sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return a.end - b.end;
    });
  }

  // ── Lookup methods (mirror Python Matches API) ────────────────────────────

  /** All matches whose name is `name`. */
  named(name: string): Match[];
  named(name: string, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined;
  named(name: string, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined {
    const arr = this.nameDict.get(name) ?? [];
    return filterIndex([...arr], predicate, index) as Match[] | Match | undefined;
  }

  /** All matches carrying tag `tag`. */
  tagged(tag: string): Match[];
  tagged(tag: string, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined;
  tagged(tag: string, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined {
    const arr = this.tagDict.get(tag) ?? [];
    return filterIndex([...arr], predicate, index) as Match[] | Match | undefined;
  }

  /** All matches starting at position `start`. */
  starting(start: number): Match[];
  starting(start: number, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined;
  starting(start: number, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined {
    const arr = this.startDict.get(start) ?? [];
    return filterIndex([...arr], predicate, index) as Match[] | Match | undefined;
  }

  /** All matches ending at position `end`. */
  ending(end: number): Match[];
  ending(end: number, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined;
  ending(end: number, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined {
    const arr = this.endDict.get(end) ?? [];
    return filterIndex([...arr], predicate, index) as Match[] | Match | undefined;
  }

  /** All matches covering position `pos`. */
  atIndex(pos: number): Match[];
  atIndex(pos: number, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined;
  atIndex(pos: number, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined {
    const arr = this.indexDict.get(pos) ?? [];
    return filterIndex([...arr], predicate, index) as Match[] | Match | undefined;
  }

  atSpan(span: [number, number], predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined {
    const starting = this.indexDict.get(span[0]) ?? [];
    const ending = this.indexDict.get(span[1] - 1) ?? [];
    const merged = [...starting];
    for (const m of ending) {
      if (!merged.includes(m)) merged.push(m);
    }
    return filterIndex(merged, predicate, index) as Match[] | Match | undefined;
  }

  atMatch(match: Match, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined {
    return this.atSpan(match.span, predicate, index);
  }

  /** All matches within the range [start, end). */
  range(start?: number, end?: number): Match[];
  range(start?: number, end?: number, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined;
  range(start = 0, end?: number, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined {
    const limit = end !== undefined ? Math.min(this.maxEnd, end) : this.maxEnd;
    const ret: Match[] = [];
    for (const m of this.sort()) {
      if (m.start < limit && m.end > start) {
        if (!predicate || predicate(m)) ret.push(m);
      }
    }
    return filterIndex(ret, null, index) as Match[] | Match | undefined;
  }

  /** Nearest match ending just before (or at) `match.start`. */
  previous(match: Match, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined {
    let current = match.start;
    while (current > -1) {
      // Find ALL matches ending at this position first (without predicate)
      const endingHere = this.ending(current) as Match[];
      if (endingHere.length > 0) {
        // Then apply predicate filter on the nearest group
        return filterIndex(endingHere, predicate, index) as Match[] | Match | undefined;
      }
      current--;
    }
    return filterIndex([], predicate, index) as Match[] | Match | undefined;
  }

  /** Nearest match starting just after (or at) `match.end`. */
  next(match: Match, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined {
    let current = match.end;
    while (current <= this.maxEnd) {
      // Find ALL matches starting at this position first (without predicate)
      const startingHere = this.starting(current) as Match[];
      if (startingHere.length > 0) {
        // Then apply predicate filter on the nearest group
        return filterIndex(startingHere, predicate, index) as Match[] | Match | undefined;
      }
      current++;
    }
    return filterIndex([], predicate, index) as Match[] | Match | undefined;
  }

  /** All matches that overlap with `match`. */
  conflicting(match: Match, predicate?: ((m: Match) => boolean) | null, index?: number | null): Match[] | Match | undefined {
    const ret: Match[] = [];
    for (let i = match.start; i < match.end; i++) {
      for (const m of this.indexDict.get(i) ?? []) {
        if (m !== match && !ret.includes(m)) ret.push(m);
      }
    }
    return filterIndex(ret, predicate, index) as Match[] | Match | undefined;
  }

  /** Matches chained before `position` separated only by chars in `seps`. */
  chainBefore(
    position: number | Match,
    seps: string,
    start = 0,
    predicate?: ((m: Match) => boolean) | null,
    index?: number | null,
  ): Match[] | Match | undefined {
    const pos = typeof position === 'number' ? position : position.start;
    const chain: Match[] = [];
    for (let i = Math.min(this.maxEnd, pos) - 1; i >= start; i--) {
      const atI = this.indexDict.get(i) ?? [];
      const filtered = predicate ? atI.filter(predicate) : [...atI];
      if (filtered.length > 0) {
        for (const m of filtered) {
          if (!chain.includes(m)) chain.push(m);
        }
      } else if (!this.inputString || !seps.includes(this.inputString[i])) {
        break;
      }
    }
    return filterIndex(chain, null, index) as Match[] | Match | undefined;
  }

  /** Matches chained after `position` separated only by chars in `seps`. */
  chainAfter(
    position: number | Match,
    seps: string,
    end?: number,
    predicate?: ((m: Match) => boolean) | null,
    index?: number | null,
  ): Match[] | Match | undefined {
    const pos = typeof position === 'number' ? position : (position as Match).end;
    const limit = end !== undefined ? Math.min(this.maxEnd, end) : this.maxEnd;
    const chain: Match[] = [];
    for (let i = pos; i < limit; i++) {
      const atI = this.indexDict.get(i) ?? [];
      const filtered = predicate ? atI.filter(predicate) : [...atI];
      if (filtered.length > 0) {
        for (const m of filtered) {
          if (!chain.includes(m)) chain.push(m);
        }
      } else if (!this.inputString || !seps.includes(this.inputString[i])) {
        break;
      }
    }
    return filterIndex(chain, null, index) as Match[] | Match | undefined;
  }

  /** All "hole" matches (gaps not covered by any existing match). */
  holes(
    start = 0,
    end?: number,
    opts: {
      formatter?: FormatterFn;
      ignore?: ((m: Match) => boolean) | null;
      seps?: string;
      predicate?: ((m: Match) => boolean) | null;
      index?: number | null;
    } = {},
  ): Match[] | Match | undefined {
    const { formatter, ignore, seps, predicate, index } = opts;
    const limit = end !== undefined ? Math.min(this.maxEnd, end) : this.maxEnd;
    const ret: Match[] = [];
    let hole = false;

    // Find actual start (skip back to find any match starting before `start`)
    let loopStart = start;
    for (let i = start - 1; i >= 0; i--) {
      for (const m of this.starting(i) as Match[] || []) {
        if (!ignore || !ignore(m)) {
          loopStart = i;
        }
      }
    }

    for (let rindex = loopStart; rindex < limit; rindex++) {
      const atI = this.indexDict.get(rindex) ?? [];
      const current = ignore ? atI.filter((m) => !ignore(m)) : [...atI];

      if (seps && hole && this.inputString && seps.includes(this.inputString[rindex])) {
        hole = false;
        ret[ret.length - 1].end = rindex;
      } else {
        if (current.length === 0 && !hole) {
          hole = true;
          ret.push(new Match(Math.max(rindex, start), 0, { inputString: this.inputString, formatter }));
        } else if (current.length > 0 && hole) {
          hole = false;
          ret[ret.length - 1].end = rindex;
        }
      }
    }

    if (ret.length > 0 && hole) {
      // Find end of last hole
      let holeEnd = limit;
      for (let rindex = limit; rindex < this.maxEnd; rindex++) {
        const atI = this.indexDict.get(rindex) ?? [];
        const current = ignore ? atI.filter((m) => !ignore(m)) : [...atI];
        if (current.length > 0) {
          holeEnd = rindex;
          break;
        }
      }
      ret[ret.length - 1].end = Math.min(holeEnd, limit);
    }

    const validHoles = ret.filter((h) => h.end > h.start);
    return filterIndex(validHoles, predicate ?? null, index ?? null) as Match[] | Match | undefined;
  }

  /** All property names present. */
  get names(): Set<string> {
    return new Set(this.nameDict.keys());
  }

  /** All tags present. */
  get allTags(): Set<string> {
    return new Set(this.tagDict.keys());
  }

  /**
   * Convert to a plain dict (like Python Matches.to_dict).
   */
  toDict(
    details = false,
    firstValue = false,
    enforceList = false,
  ): MatchesDict {
    const ret = new MatchesDict();

    for (const match of this.sort()) {
      const val = details ? match : match.value;

      // Track matches
      const matchArr = ret.matches.get(match.name ?? '') ?? [];
      matchArr.push(match);
      ret.matches.set(match.name ?? '', matchArr);

      // Track values list
      if (!enforceList) {
        const valArr = ret.valuesList.get(match.name ?? '') ?? [];
        if (!valArr.includes(val)) valArr.push(val);
        ret.valuesList.set(match.name ?? '', valArr);
      }

      const existing = ret.get(match.name ?? '');
      if (existing !== undefined) {
        if (!firstValue) {
          if (Array.isArray(existing)) {
            if (!existing.includes(val)) existing.push(val);
          } else {
            if (existing !== val) ret.set(match.name!, [existing, val]);
          }
        }
      } else {
        ret.set(match.name!, enforceList && !Array.isArray(val) ? [val] : val);
      }
    }

    return ret;
  }

  toString(): string {
    return `[${this._delegate.map(String).join(', ')}]`;
  }
}

// ─── Matches ──────────────────────────────────────────────────────────────────

export class Matches extends _BaseMatches {
  markers: Markers;

  constructor(matches?: Match[] | null, inputString?: string) {
    super(undefined, inputString);
    this.markers = new Markers(undefined, inputString);
    if (matches) this.extend(matches);
  }

  protected override _addMatch(match: Match): void {
    if (match.marker) throw new Error('A marker match should not be added to Matches');
    super._addMatch(match);
  }
}

// ─── Markers ─────────────────────────────────────────────────────────────────

export class Markers extends _BaseMatches {
  constructor(matches?: Match[] | null, inputString?: string) {
    super(undefined, inputString);
    if (matches) this.extend(matches);
  }

  protected override _addMatch(match: Match): void {
    if (!match.marker) throw new Error('A non-marker match should not be added to Markers');
    super._addMatch(match);
  }
}
