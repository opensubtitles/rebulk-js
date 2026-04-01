/**
 * Topological sort — port of rebulk/toposort.py
 * Original: https://bitbucket.org/ericvsmith/toposort (v1.4)
 */

export class CyclicDependency extends Error {
  cyclic: Map<unknown, Set<unknown>>;
  constructor(cyclic: Map<unknown, Set<unknown>>) {
    const parts = [...cyclic.entries()].map(([k, v]) => `${String(k)} -> ${[...v].map(String).join(', ')}`);
    super(`Cyclic dependencies exist among these items: ${parts.join('; ')}`);
    this.cyclic = cyclic;
    this.name = 'CyclicDependency';
  }
}

/**
 * Perform a topological sort.
 * @param data  Map where each key depends on the values in its Set.
 * @yields Sets of items with no remaining dependencies, in order.
 */
export function* toposort<T>(data: Map<T, Set<T>>): Generator<Set<T>> {
  if (data.size === 0) return;

  // Work on a copy so we don't mutate the caller's map.
  const workData = new Map<T, Set<T>>();
  for (const [k, v] of data) {
    const deps = new Set(v);
    deps.delete(k); // ignore self-deps
    workData.set(k, deps);
  }

  // Collect all dependency items that may not be explicit keys.
  const allDeps = new Set<T>();
  for (const deps of workData.values()) {
    for (const d of deps) allDeps.add(d);
  }
  for (const dep of allDeps) {
    if (!workData.has(dep)) workData.set(dep, new Set());
  }

  while (workData.size > 0) {
    const ordered = new Set<T>();
    for (const [item, deps] of workData) {
      if (deps.size === 0) ordered.add(item);
    }
    if (ordered.size === 0) {
      throw new CyclicDependency(workData as Map<unknown, Set<unknown>>);
    }
    yield ordered;
    for (const item of ordered) workData.delete(item);
    for (const deps of workData.values()) {
      for (const item of ordered) deps.delete(item);
    }
  }
}
