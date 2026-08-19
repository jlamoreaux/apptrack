/**
 * Next vendors path-to-regexp without type declarations. The header-source
 * tests compile route patterns with the exact copy Next itself uses, so this
 * shim declares the one function they call.
 */
declare module "next/dist/compiled/path-to-regexp" {
  export function pathToRegexp(path: string, keys?: unknown[]): RegExp;
}
