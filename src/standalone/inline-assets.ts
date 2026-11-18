// Normal single-file build: no embedded images (they load from the CDN).
// The offline build (node tools/build-standalone.mjs --offline) swaps this file for a generated map of data URLs.
export const INLINE_ASSETS: Record<string, string> = {};
