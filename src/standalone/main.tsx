// Entry of the single-file build (tools/build-standalone.mjs -> dist-standalone/live-class-en.html).
// The app renders inside a Shadow DOM so the blog theme (Blogger, WordPress...) cannot break its layout
// and the game's CSS cannot change the blog.
import { ASSET_BASES } from './assetInit'; // FIRST: sets the image base before the stage module loads
import { createRoot } from 'react-dom/client';
import { setRoomBgResolver, setAssetBase, assetBase, hasInlineAssets } from '../live/asset';
import { installLocalServer, roomBgUrl } from './localServer';
import { CSS, GLOBAL_CSS } from './generated-css';

// remember which <script> tag we are (document.currentScript is gone after the page finishes loading)
const SCRIPT = document.currentScript;

installLocalServer();
setRoomBgResolver(() => roomBgUrl());

const FONTS = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&family=Patrick+Hand&family=Dancing+Script:wght@700&display=swap';

function addGlobal() {
  if (document.getElementById('live-class-en-global')) return;
  const style = document.createElement('style');
  style.id = 'live-class-en-global';
  // custom-property registrations (@property) only work at document level, not inside a shadow root
  style.textContent = GLOBAL_CSS;
  document.head.appendChild(style);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS;
  document.head.appendChild(link);
}

/** an image failed on the first CDN: switch every image to the next mirror */
function watchImages(root: ShadowRoot) {
  let i = Math.max(0, ASSET_BASES.indexOf(assetBase()));
  root.addEventListener(
    'error',
    (e) => {
      const el = e.target as HTMLImageElement;
      if (!el || el.tagName !== 'IMG') return;
      const src = el.getAttribute('src') || '';
      const from = ASSET_BASES.find((b) => src.startsWith(b));
      if (!from) return;
      const at = ASSET_BASES.indexOf(from);
      if (at + 1 >= ASSET_BASES.length) return;
      if (at >= i) {
        i = at + 1;
        setAssetBase(ASSET_BASES[i]);
      }
      el.setAttribute('src', ASSET_BASES[at + 1] + src.slice(from.length));
    },
    true,
  );
}

function mount() {
  let host = document.getElementById('live-class-en');
  if (!host) {
    host = document.createElement('div');
    host.id = 'live-class-en';
    if (SCRIPT?.parentNode) SCRIPT.parentNode.insertBefore(host, SCRIPT);
    else document.body.appendChild(host);
  }
  if ((host as HTMLElement & { __lc?: boolean }).__lc) return;
  (host as HTMLElement & { __lc?: boolean }).__lc = true;
  host.style.display = 'block';
  host.style.width = '100%';
  addGlobal();
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS;
  shadow.appendChild(style);
  const app = document.createElement('div');
  app.className = 'lc-root';
  app.innerHTML = '<div style="padding:40px 16px;text-align:center;color:#94a3b8;font:16px system-ui,sans-serif">Loading LIVE-CLASS…</div>';
  shadow.appendChild(app);
  watchImages(shadow);
  // pick a working image CDN BEFORE the stage module loads (it builds its image lists when it loads)
  void pickBase().then(async () => {
    const { StandaloneApp } = await import('./App');
    app.innerHTML = '';
    createRoot(app).render(<StandaloneApp />);
  });
}

/** try each image mirror with one small request; the first that answers wins */
function probe(url: string, ms: number) {
  return new Promise<boolean>((ok) => {
    const img = new Image();
    const timer = setTimeout(() => done(false), ms);
    function done(v: boolean) {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      ok(v);
    }
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;
  });
}
async function pickBase() {
  if (hasInlineAssets()) return; // offline build: images are inside the file
  for (const b of ASSET_BASES) {
    if (await probe(`${b}/assets/bg/lop.webp`, 5000)) {
      setAssetBase(b);
      return;
    }
  }
  setAssetBase(ASSET_BASES[0]);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
