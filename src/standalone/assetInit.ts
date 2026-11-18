// Must be imported FIRST by the standalone entry: the stage builds its image lists when its module loads.
// Images are served from the public GitHub repo through a CDN, so the HTML file stays small enough for Blogger.
// Override before the script tag:  <script>window.LIVE_CLASS_ASSETS = 'https://your.host/public';</script>
import { setAssetBase, setInlineAssets } from '../live/asset';
import { INLINE_ASSETS } from './inline-assets';

const REPO = 'dxkon123/LIVE-CLASS';
const COMMIT = '4ef30237a07fcc9a63672df764f5a4d91da69ad5';
export const CDN_BASES = [
  `https://cdn.jsdelivr.net/gh/${REPO}@${COMMIT}/public`,
  `https://raw.githubusercontent.com/${REPO}/${COMMIT}/public`,
];

const custom = (window as unknown as { LIVE_CLASS_ASSETS?: string }).LIVE_CLASS_ASSETS;
export const ASSET_BASES = custom ? [custom, ...CDN_BASES] : CDN_BASES;
setAssetBase(ASSET_BASES[0]);
setInlineAssets(INLINE_ASSETS);
