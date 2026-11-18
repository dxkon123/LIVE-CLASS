// Build flag: the single-file HTML build (tools/build-standalone.mjs) defines __STANDALONE__ = true.
// The normal Vite + server.ts build leaves it undefined.
declare const __STANDALONE__: boolean | undefined;
export const STANDALONE: boolean = typeof __STANDALONE__ !== 'undefined' && !!__STANDALONE__;
