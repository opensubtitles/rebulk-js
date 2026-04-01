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
              if (process.env.DEBUG_CONFLICT) console.log(`[ConflictSolver] removing ${(toRem as any).name}=${(toRem as any).value}@[${(toRem as any).start},${(toRem as any).end}) parent=${(toRem as any).parent?.name}@[${(toRem as any).parent?.start},${(toRem as any).parent?.end}) private=${(toRem as any).parent?.private} keeping ${(toKeep as any).name}=${(toKeep as any).value}@[${(toKeep as any).start},${(toKeep as any).end}) raw="${(toKeep as any).raw}" initLen=${(toKeep as any).initiator?.length} tags=${JSON.stringify((toKeep as any).tags)}`);
              // If the removed match has a private parent (chain), also remove siblings.
              // This prevents orphaned chain children (e.g. season=1 from "1.x264" chain
              // when episode=264 is removed due to conflict with video_codec).
              const parent = (toRem as any).parent;
              if (parent && parent.private) {
                for (const sibling of parent.children) {
                  if (!toRemove.has(sibling) && !toRemove.has(toKeep)) {
                    if (process.env.DEBUG_CONFLICT) console.log(`  [CS sibling] also removing sibling ${(sibling as any).name}=${(sibling as any).value}@[${(sibling as any).start},${(sibling as any).end})`);
                    toRemove.add(sibling);
                  }
                }
              }
            }
          }
          break;
        }
      }
    }

    return toRemove;
  }

  override then(matches: Matches, whenResponse: IdentitySet<Match>, context: Context): void {
    const rm = new RemoveMatch();
    rm.then(matches, [...whenResponse], context);
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
