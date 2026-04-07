/**
 * Built-in processors — port of rebulk/processors.py
 */
import { Rule, RemoveMatch } from './rules.js';
import { IdentitySet } from './utils.js';
import type { Match, Matches } from './match.js';
import type { Context } from './pattern.js';

export const DEFAULT_SYMBOL = '__default__';
export const PRE_PROCESS = 2048;
export const POST_PROCESS = -2048;

function defaultConflictSolver(match: Match, conflicting: Match): Match | null {
  if (conflicting.initiator.length < match.initiator.length) return conflicting;
  if (match.initiator.length < conflicting.initiator.length) return match;
  return null;
}

export class ConflictSolver extends Rule {
  static override priority = PRE_PROCESS;
  override priority = PRE_PROCESS;
  consequence = RemoveMatch;

  get defaultConflictSolverFn() {
    return defaultConflictSolver;
  }

  override when(matches: Matches, _context: Context): IdentitySet<Match> {
    const toRemove = new IdentitySet<Match>();
    const publicMatches = matches.toArray().filter((m) => !m.private).sort((a, b) => a.length - b.length);

    for (const match of publicMatches) {
      const conflicting = (matches.conflicting(match) as Match[] | undefined) ?? [];
      if (!conflicting.length) continue;

      const publicConflicting = conflicting.filter((c) => !c.private).sort((a, b) => a.length - b.length);
      for (const conflictingMatch of publicConflicting) {
        const solvers: [((a: Match, b: Match) => Match | null | '__default__'), boolean][] = [
          [this.defaultConflictSolverFn, false],
        ];
        if (match.conflictSolver) solvers.push([match.conflictSolver, false]);
        if (conflictingMatch.conflictSolver) solvers.push([conflictingMatch.conflictSolver, true]);

        for (let si = solvers.length - 1; si >= 0; si--) {
          const [solver, reverse] = solvers[si];
          const toRem = reverse ? solver(conflictingMatch, match) : solver(match, conflictingMatch);
          if (toRem === DEFAULT_SYMBOL) continue;
          if (toRem && !toRemove.has(toRem)) {
            const toKeep = toRem === match ? conflictingMatch : match;
            if (!toRemove.has(toKeep)) {
              toRemove.add(toRem);
            }
          }
          break;
        }
      }
    }

    return toRemove;
  }
}

export class PrivateRemover extends Rule {
  static override priority = POST_PROCESS;
  override priority = POST_PROCESS;
  consequence = RemoveMatch;

  override when(matches: Matches, _context: Context): Match[] {
    return matches.toArray().filter((m) => m.private);
  }
}
