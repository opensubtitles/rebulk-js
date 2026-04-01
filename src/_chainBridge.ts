/**
 * Bridge module to break the circular dependency between builder.ts and chain.ts.
 * chain.ts registers itself here; builder.ts looks it up at runtime.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ChainCtor: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerChain(ctor: any): void {
  _ChainCtor = ctor;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getChainClass(): any {
  return _ChainCtor;
}
