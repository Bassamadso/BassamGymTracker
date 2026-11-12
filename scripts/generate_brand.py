#!/usr/bin/env python3
"""
Generates the ADSO logo (SVG + PNG), Android/iOS app icons and splash images.

The mark is the white "BA" monogram in assets/brand/logo-source.jpg. It is
cleaned up (JPEG noise removed, edges sharpened), rendered at every size
needed, and traced to vector for the SVGs. To change the logo, replace
logo-source.jpg (white mark on black) and re-run from the project root:

    python3 scripts/generate_brand.py

Requires Pillow (pip install pillow).
"""
import json
import math
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = (10, 10, 11)  # #0A0A0B
LIME = (198, 255, 61)  # #C6FF3D
WHITE = (245, 245, 247)  # text
MARK = (255, 255, 255)  # logo colour, as in the source image
BG_HEX, MARK_HEX = "#0A0A0B", "#FFFFFF"

SLOGAN = "ACHIEVE · DREAMS · STRIVE · ONWARD"

# ── Mark ──────────────────────────────────────────────────────────────────
SOURCE = os.path.join(ROOT, "assets", "brand", "logo-source.jpg")
UP = 4  # master resolution, as a multiple of the source image
PAD = 4  # empty margin (source px) kept around the mark


def load_master():
    """Alpha mask of the mark: tight crop plus margin, UP× larger, crisp edges.

    Returns (mask, box); box is the mark's tight bounds in mask pixels.
    """
    src = Image.open(SOURCE).convert("L")
    x0, y0, x1, y1 = src.point(lambda v: 255 if v > 128 else 0).getbbox()
    crop = src.crop((x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD))
    big = crop.resize((crop.width * UP, crop.height * UP), Image.BICUBIC)
    # JPEG edges are soft. A steep ramp around mid-grey makes them about one
    # master pixel wide without moving them, and wipes out compression noise.
    mask = big.point(lambda v: max(0, min(255, (v - 128) * 6 + 128)))
    return mask, mask.point(lambda v: 255 if v >= 128 else 0).getbbox()


MASTER, BOX = load_master()


def render(size: int, *, shape: str = "square", mark_ratio=0.78, bg=BG,
           transparent=False) -> Image.Image:
    """shape: 'square' (full bleed), 'rounded', 'circle'.

    mark_ratio is the mark's width (its longer side) as a share of the canvas.
    """
    ss = 4 if size <= 512 else 2  # supersample: the master's edges are sharp
    S = size * ss
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if not transparent:
        if shape == "square":
            d.rectangle([0, 0, S, S], fill=bg)
        elif shape == "rounded":
            d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.22, fill=bg)
        else:
            d.ellipse([0, 0, S - 1, S - 1], fill=bg)
    bx0, by0, bx1, by1 = BOX
    k = S * mark_ratio / (bx1 - bx0)
    mask = MASTER.resize((round(MASTER.width * k), round(MASTER.height * k)), Image.LANCZOS)
    alpha = Image.new("L", (S, S), 0)
    alpha.paste(mask, (round(S / 2 - (bx0 + bx1) / 2 * k), round(S / 2 - (by0 + by1) / 2 * k)))
    layer = Image.new("RGBA", (S, S), MARK + (255,))
    layer.putalpha(alpha)
    img.alpha_composite(layer)
    return img.resize((size, size), Image.LANCZOS) if ss > 1 else img


# ── Vector trace (marching squares) ────────────────────────────────────────
def _loops(img: Image.Image, level=128):
    """Closed contours of img >= level, sub-pixel accurate, as lists of (x, y).

    Every contour keeps the inside on its right, so outer edges and holes run
    in opposite directions. The image must have an empty border.
    """
    w, h = img.size
    px = img.tobytes()
    nxt, pt = {}, {}
    for y in range(h - 1):
        r0 = y * w
        r1 = r0 + w
        for x in range(w - 1):
            tl, tr, bl, br = px[r0 + x], px[r0 + x + 1], px[r1 + x], px[r1 + x + 1]
            i_tl, i_tr, i_br, i_bl = tl >= level, tr >= level, br >= level, bl >= level
            n = i_tl + i_tr + i_br + i_bl
            if n == 0 or n == 4:
                continue
            # Edge crossings, clockwise: top, right, bottom, left.
            # (key, point, leaving-the-inside?)
            cr = []
            if i_tl != i_tr:
                t = (level - tl) / (tr - tl)
                cr.append(((r0 + x) * 2, (x + t, y), i_tl))
            if i_tr != i_br:
                t = (level - tr) / (br - tr)
                cr.append(((r0 + x + 1) * 2 + 1, (x + 1, y + t), i_tr))
            if i_br != i_bl:
                t = (level - br) / (bl - br)
                cr.append(((r1 + x) * 2, (x + 1 - t, y + 1), i_br))
            if i_bl != i_tl:
                t = (level - bl) / (tl - bl)
                cr.append(((r0 + x) * 2 + 1, (x, y + 1 - t), i_bl))
            m = len(cr)
            for i, (key, p, leaving) in enumerate(cr):
                pt[key] = p
                if leaving:  # joins to the next crossing that re-enters
                    j = (i + 1) % m
                    while cr[j][2]:
                        j = (j + 1) % m
                    nxt[key] = cr[j][0]
    loops, seen = [], set()
    for start in nxt:
        if start in seen:
            continue
        loop, k = [], start
        while k not in seen:
            seen.add(k)
            loop.append(pt[k])
            k = nxt[k]
        loops.append(loop)
    return loops


def _rdp(pts, eps):
    """Douglas–Peucker on an open polyline."""
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = pts[a], pts[b]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy) or 1e-9
        best, idx = 0.0, None
        for i in range(a + 1, b):
            dist = abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / norm
            if dist > best:
                best, idx = dist, i
        if idx is not None and best > eps:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, kp in zip(pts, keep) if kp]


def _simplify_closed(pts, eps):
    far = max(range(len(pts)), key=lambda i: math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]))
    return _rdp(pts[: far + 1], eps)[:-1] + _rdp(pts[far:] + [pts[0]], eps)[:-1]


def mark_paths(ratio: float, scale: int = 2):
    """SVG path data for the mark in a 1024 box, `ratio` of it wide."""
    field = MASTER.resize((MASTER.width // scale, MASTER.height // scale), Image.LANCZOS)
    bx0, by0, bx1, by1 = BOX
    k = 1024 * ratio / (bx1 - bx0)
    cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2

    def to_design(p):  # vertex -> continuous master px -> 1024 box
        return (((p[0] + 0.5) * scale - cx) * k + 512, ((p[1] + 0.5) * scale - cy) * k + 512)

    d = []
    for loop in _loops(field):
        pts = [to_design(p) for p in _simplify_closed(loop, 0.3)]
        d.append("M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z")
    return "".join(d)


def svg_mark(with_bg: bool) -> str:
    bg = f'  <rect width="1024" height="1024" rx="225" fill="{BG_HEX}"/>\n' if with_bg else ""
    path = mark_paths(0.78 if with_bg else 1)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <title>BA · ADSO</title>
{bg}  <path fill="{MARK_HEX}" fill-rule="evenodd" d="{path}"/>
</svg>
'''


def font(size: int, weight: int, width: int = 100):
    f = ImageFont.truetype("/usr/share/fonts/truetype/ubuntu/UbuntuSans[wdth,wght].ttf", size)
    f.set_variation_by_axes([width, weight])
    return f


def wordmark_preview(path: str):
    """Full lockup: mark + ADSO + slogan + byline (for sharing / store art)."""
    W, H = 1600, 1000
    img = Image.new("RGBA", (W, H), BG + (255,))
    mark = render(380, transparent=True, mark_ratio=1)
    img.alpha_composite(mark, ((W - 380) // 2, 110))
    d = ImageDraw.Draw(img)

    def centered(text, y, f, fill, spacing=0):
        # manual letter spacing
        widths = [d.textlength(c, font=f) for c in text]
        total = sum(widths) + spacing * (len(text) - 1)
        x = (W - total) / 2
        for c, w in zip(text, widths):
            d.text((x, y), c, font=f, fill=fill)
            x += w + spacing

    centered("ADSO", 520, font(170, 800), WHITE, spacing=28)
    centered(SLOGAN, 735, font(40, 700), LIME, spacing=6)
    centered("by Bassam Adso", 820, font(34, 400), (138, 138, 147))
    img.convert("RGB").save(path)


def write(path: str, img: Image.Image):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)


def main():
    brand = os.path.join(ROOT, "assets", "brand")
    os.makedirs(brand, exist_ok=True)
    with open(os.path.join(brand, "logo.svg"), "w") as f:
        f.write(svg_mark(with_bg=True))
    with open(os.path.join(brand, "logo-mark.svg"), "w") as f:
        f.write(svg_mark(with_bg=False))
    write(os.path.join(brand, "logo-1024.png"), render(1024, shape="rounded"))
    write(os.path.join(brand, "logo-mark.png"), render(512, transparent=True, mark_ratio=1))
    write(os.path.join(brand, "logo-mark@2x.png"), render(1024, transparent=True, mark_ratio=1))
    wordmark_preview(os.path.join(brand, "logo-lockup.png"))

    # ── Android launcher icons ──
    res = os.path.join(ROOT, "android", "app", "src", "main", "res")
    densities = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
    for name, k in densities.items():
        d = os.path.join(res, f"mipmap-{name}")
        write(os.path.join(d, "ic_launcher.png"), render(int(48 * k), shape="rounded", mark_ratio=0.72))
        write(os.path.join(d, "ic_launcher_round.png"), render(int(48 * k), shape="circle", mark_ratio=0.7))
        # Adaptive icon foreground: 108dp canvas, mark kept inside the 66dp safe zone
        write(os.path.join(d, "ic_launcher_foreground.png"),
              render(int(108 * k), transparent=True, mark_ratio=0.5))
        # Splash icon (Android 12+ shows it inside a 160dp circle on a 240dp canvas)
        write(os.path.join(d, "splash_icon.png"),
              render(int(240 * k), transparent=True, mark_ratio=0.5))

    # ── iOS app icon + launch image ──
    appicon = os.path.join(ROOT, "ios", "GymTracker", "Images.xcassets", "AppIcon.appiconset")
    with open(os.path.join(appicon, "Contents.json")) as f:
        contents = json.load(f)
    for entry in contents["images"]:
        pts = float(entry["size"].split("x")[0])
        px = int(round(pts * int(entry["scale"].rstrip("x"))))
        fname = f"icon-{px}.png"
        entry["filename"] = fname
        # iOS applies its own rounded mask and forbids transparency
        render(px, shape="square", mark_ratio=0.72).convert("RGB").save(os.path.join(appicon, fname))
    with open(os.path.join(appicon, "Contents.json"), "w") as f:
        json.dump(contents, f, indent=2)

    splash = os.path.join(ROOT, "ios", "GymTracker", "Images.xcassets", "SplashLogo.imageset")
    os.makedirs(splash, exist_ok=True)
    for k in (1, 2, 3):
        render(160 * k, transparent=True, mark_ratio=1).save(
            os.path.join(splash, f"splash-logo@{k}x.png"))
    with open(os.path.join(splash, "Contents.json"), "w") as f:
        json.dump({
            "images": [
                {"idiom": "universal", "filename": f"splash-logo@{k}x.png", "scale": f"{k}x"}
                for k in (1, 2, 3)
            ],
            "info": {"version": 1, "author": "xcode"},
        }, f, indent=2)

    print("Brand assets generated.")


if __name__ == "__main__":
    main()
