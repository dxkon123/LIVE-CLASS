// Removes the grey background from character art with Node (for PCs without Python), same method as tools/remove-bg.py.
// Needs sharp (install it in another folder and point NODE_PATH at it):  node tools/remove-bg.mjs thay-giao thay
// argument 1: folder inside characters/   argument 2: output folder inside public/assets/nv/
// Every pose is cropped with the same box so the feet stay in place when the pose changes.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const [srcName, outName] = process.argv.slice(2);
if (!srcName || !outName) throw new Error('Usage: node tools/remove-bg.mjs <folder in characters> <output folder>');
const SRC = path.join(ROOT, 'characters', srcName);
const OUT = path.join(ROOT, 'public', 'assets', 'nv', outName);
const TOL = 14; // max colour distance from the grey background
const HOLE_MIN = 300; // enclosed grey areas (between arm and body) bigger than this many px count as background
const OUT_H = 560;

async function alphaOf(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const px = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
  // background colour = median of the image border
  const border = [];
  for (let x = 0; x < W; x++) border.push(px(x), px((H - 1) * W + x));
  for (let y = 0; y < H; y++) border.push(px(y * W), px(y * W + W - 1));
  const bg = [0, 1, 2].map((c) => border.map((p) => p[c]).sort((a, b) => a - b)[border.length >> 1]);
  const diff = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const p = px(i);
    diff[i] = Math.max(Math.abs(p[0] - bg[0]), Math.abs(p[1] - bg[1]), Math.abs(p[2] - bg[2]));
  }
  // label the regions close to the background colour
  const lab = new Int32Array(W * H);
  const isBg = new Uint8Array(W * H);
  let n = 0;
  const stack = [];
  for (let s = 0; s < W * H; s++) {
    if (lab[s] || diff[s] > TOL) continue;
    n++;
    lab[s] = n;
    stack.push(s);
    const members = [];
    let edge = false;
    let tight = 0;
    while (stack.length) {
      const i = stack.pop();
      members.push(i);
      if (diff[i] <= 6) tight++;
      const x = i % W, y = (i / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j >= 0 && !lab[j] && diff[j] <= TOL) {
          lab[j] = n;
          stack.push(j);
        }
      }
    }
    if (edge || (members.length >= HOLE_MIN && tight / members.length > 0.9)) for (const i of members) isBg[i] = 1;
  }
  // 2 px soft edge
  const alpha = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) alpha[i] = isBg[i] ? 0 : 255;
  let ring = isBg;
  for (let it = 0; it < 2; it++) {
    const grown = new Uint8Array(ring);
    for (let i = 0; i < W * H; i++) {
      if (ring[i]) continue;
      const x = i % W, y = (i / W) | 0;
      if ((x > 0 && ring[i - 1]) || (x < W - 1 && ring[i + 1]) || (y > 0 && ring[i - W]) || (y < H - 1 && ring[i + W])) grown[i] = 1;
    }
    ring = grown;
  }
  for (let i = 0; i < W * H; i++) if (ring[i] && !isBg[i]) alpha[i] = Math.round(Math.min(1, Math.max(0.35, (diff[i] - TOL) / 30)) * 255);
  // keep only the biggest blob (the character): drops stray specks such as the image generator's ✦ mark in a corner
  const comp = new Int32Array(W * H);
  let best = 0, bestSize = 0, id = 0;
  for (let s = 0; s < W * H; s++) {
    if (!alpha[s] || comp[s]) continue;
    id++;
    comp[s] = id;
    stack.push(s);
    let size = 0;
    while (stack.length) {
      const i = stack.pop();
      size++;
      const x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j >= 0 && alpha[j] && !comp[j]) {
          comp[j] = id;
          stack.push(j);
        }
      }
    }
    if (size > bestSize) [best, bestSize] = [id, size];
  }
  for (let i = 0; i < W * H; i++) if (comp[i] !== best) alpha[i] = 0;
  return { data, alpha, W, H };
}

const files = fs.readdirSync(SRC).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
// folder with a single image (e.g. the hall monitor): write it as 01-dung.webp so the game finds it
const fileOut = (f) => (files.length === 1 ? '01-dung.webp' : f.replace(/\.(png|jpe?g)$/i, '.webp'));
const imgs = [];
let x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0;
for (const f of files) {
  const r = await alphaOf(path.join(SRC, f));
  for (let i = 0; i < r.W * r.H; i++) {
    if (!r.alpha[i]) continue;
    const x = i % r.W, y = (i / r.W) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  imgs.push({ f, ...r });
}
fs.mkdirSync(OUT, { recursive: true });
for (const { f, data, alpha, W, H } of imgs) {
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    rgba[i * 4] = data[i * 3];
    rgba[i * 4 + 1] = data[i * 3 + 1];
    rgba[i * 4 + 2] = data[i * 3 + 2];
    rgba[i * 4 + 3] = alpha[i];
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: x0, top: y0, width: w, height: h })
    .resize({ height: OUT_H, kernel: 'lanczos3' })
    .webp({ quality: 90 })
    .toFile(path.join(OUT, fileOut(f)));
}
console.log(outName, files.length, 'poses, box', [x0, y0, x1 + 1, y1 + 1]);
