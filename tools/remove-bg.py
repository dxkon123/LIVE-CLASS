"""Removes the grey background from character art -> transparent webp files in public/assets/nv/.
Run it again after changing the art in characters/:  python tools/remove-bg.py
Every pose of a character is cropped with the same box so the feet stay in place when the pose changes."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'characters'
OUT = ROOT / 'public' / 'assets'
CHARS = {'co-giao-ao-dai-trang': 'co-giao', 'co-giao-ngan': 'co-ngan', 'hoc-sinh-nam': 'nam', 'hoc-sinh-nu': 'nu'}
TOL = 14          # max colour distance from the grey background
HOLE_MIN = 300    # enclosed grey areas (between arm and body) bigger than this many px count as background
OUT_H = 560       # output image height


def alpha_of(a: np.ndarray) -> np.ndarray:
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    diff = np.abs(a.astype(int) - bg).max(axis=2)
    near = diff <= TOL
    lab, n = ndimage.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    sizes = ndimage.sum(near, lab, range(n + 1))
    # background = area touching the border + big enclosed areas very close to the background colour
    tight = diff <= 6
    keep = np.zeros(n + 1, bool)
    keep[list(edge)] = True
    for i in range(1, n + 1):
        if not keep[i] and sizes[i] >= HOLE_MIN and tight[lab == i].mean() > 0.9:
            keep[i] = True
    bgmask = keep[lab]
    # soft edge: pixels next to the background and close to its colour become partly transparent
    ring = ndimage.binary_dilation(bgmask, iterations=2) & ~bgmask
    alpha = np.where(bgmask, 0, 255).astype(np.float32)
    alpha[ring] = np.clip((diff[ring] - TOL) / 30, 0.35, 1) * 255
    return alpha.astype(np.uint8)


def make_backs(folder: Path):
    """The art only has front views: build a back view (sau-*.webp) for students facing the board.
    Removes the head completely (the game draws many hair styles in code), flips horizontally, writes the head box to head.json."""
    base = np.array(Image.open(folder / '01-dung.webp').convert('RGBA'))
    H, W = base.shape[:2]
    op = base[..., 3] > 0
    widths = op.sum(axis=1)
    lo, hi = int(H * 0.12), int(H * 0.38)
    neck = lo + int(np.argmin(widths[lo:hi]))
    head = op.copy()
    head[neck - int(H * 0.012):] = False  # leave the neck
    head = ndimage.binary_fill_holes(ndimage.binary_dilation(head, iterations=4))
    ys, xs = np.where(head)
    box = {'x': float(W - 1 - xs.max()) / W, 'y': float(ys.min()) / H, 'w': float(xs.max() - xs.min()) / W, 'h': float(ys.max() - ys.min()) / H}
    (folder / 'head.json').write_text(json.dumps(box))
    for f in sorted(folder.glob('0*.webp')):
        a = np.array(Image.open(f).convert('RGBA'))
        a[head, 3] = 0
        Image.fromarray(a, 'RGBA').transpose(Image.FLIP_LEFT_RIGHT).save(folder / ('sau-' + f.name), quality=90)


def main():
    for folder, key in CHARS.items():
        files = sorted((SRC / folder).glob('*.png'))
        imgs = []
        for f in files:
            a = np.array(Image.open(f).convert('RGB'))
            imgs.append((f, a, alpha_of(a)))
        ys, xs = np.where(np.any([al > 0 for _, _, al in imgs], axis=0))
        box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        (OUT / 'nv' / key).mkdir(parents=True, exist_ok=True)
        for f, a, al in imgs:
            im = Image.fromarray(np.dstack([a, al]), 'RGBA').crop(box)
            w = round(im.width * OUT_H / im.height)
            im.resize((w, OUT_H), Image.LANCZOS).save(OUT / 'nv' / key / (f.stem + '.webp'), quality=90)
        if key != 'co-giao':
            make_backs(OUT / 'nv' / key)
        print(key, len(files), 'poses, box', box)
    (OUT / 'bg').mkdir(parents=True, exist_ok=True)
    Image.open(SRC / 'nen-lop-hoc-rong-khong-nguoi-2d.png').convert('RGB').save(OUT / 'bg' / 'lop.webp', quality=92)


if __name__ == '__main__':
    main()
