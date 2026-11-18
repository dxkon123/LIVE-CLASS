// Where the images live. Server build: same origin ("/assets/..."). Single-file build: a CDN base set at startup.
let base = '';
let inline: Record<string, string> | null = null;
export function setAssetBase(b: string) {
  base = b.replace(/\/+$/, '');
}
/** offline single-file build: every image is embedded as a data URL */
export function setInlineAssets(map: Record<string, string>) {
  inline = Object.keys(map).length ? map : null;
}
export const hasInlineAssets = () => !!inline;
export const assetBase = () => base;
/** "/assets/nv/nam/01-dung.webp" -> full URL (or the embedded copy) */
export const asset = (p: string) => (inline?.[p] ?? (p.startsWith('/') ? base + p : p));

// Custom classroom background chosen in the teacher panel.
// Server build: an uploaded file served at /room-bg/<file>. Single-file build: a data URL kept in the browser.
let bgResolver: (bg: string) => string = (bg) => `/room-bg/${bg}`;
export function setRoomBgResolver(fn: (bg: string) => string) {
  bgResolver = fn;
}
export const roomBgSrc = (bg: string) => (bg ? bgResolver(bg) : '');
