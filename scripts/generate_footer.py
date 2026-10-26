"""Build the animated tech-stack footer used at the bottom of the profile README.

Pipeline:
  1. download each logo as SVG from devicon (cached in scripts/svg_cache)
  2. rasterize to PNG sprites (assets/interactive-icons + docs/assets/icons)
  3. paint a dark starfield backdrop
  4. float the sprites around their home positions -> footer-physics.gif / .webp
  5. write icons-metadata.json consumed by the interactive sandbox in docs/

Run from the repo root:  python scripts/generate_footer.py
Requires: pillow numpy resvg-py
"""
import json
import math
import random
import urllib.request
from io import BytesIO
from pathlib import Path

import numpy as np
import resvg_py
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / "svg_cache"
SPRITES = ROOT / "assets" / "interactive-icons"
DOCS_ICONS = ROOT / "docs" / "assets" / "icons"

W, H = 1024, 204
DEVICON = "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/{0}/{0}-{1}.svg"
SIZE = 54

# id, display name, devicon folder, variant, recolor (old -> new) for logos that vanish on dark bg
ICONS = [
    # row 1 - languages
    ("javascript", "JavaScript", "javascript", "original", None),
    ("typescript", "TypeScript", "typescript", "original", None),
    ("java", "Java", "java", "original", None),
    ("python", "Python", "python", "original", None),
    ("csharp", "C#", "csharp", "original", None),
    ("c", "C", "c", "original", None),
    ("cpp", "C++", "cplusplus", "original", None),
    ("spring", "Spring Boot", "spring", "original", None),
    # row 2 - frontend + backend
    ("react", "React", "react", "original", None),
    ("tailwind", "Tailwind CSS", "tailwindcss", "original", None),
    ("html5", "HTML5", "html5", "original", None),
    ("css3", "CSS3", "css3", "original", None),
    ("dotnet", ".NET", "dotnetcore", "original", None),
    ("figma", "Figma", "figma", "original", None),
    ("postman", "Postman", "postman", "original", None),
    # row 3 - data + tooling
    ("postgresql", "PostgreSQL", "postgresql", "original", None),
    ("mongodb", "MongoDB", "mongodb", "original", None),
    ("sqlserver", "SQL Server", "microsoftsqlserver", "plain", None),
    ("docker", "Docker", "docker", "original", None),
    ("git", "Git", "git", "original", None),
    ("github", "GitHub", "github", "original", ("#181616", "#ffffff")),
    ("vscode", "VS Code", "vscode", "original", None),
]
ROWS = [8, 7, 7]
ROW_Y = [42, 102, 162]

# Icons sitting on the lowest row hover less so they stay inside the banner
GROUNDED = {i[0] for i in ICONS[-7:]}


def fetch_svg(icon_id, folder, variant, recolor):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{icon_id}.svg"
    if not path.exists():
        url = DEVICON.format(folder, variant)
        print("download", url)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        path.write_bytes(urllib.request.urlopen(req, timeout=30).read())
    svg = path.read_text(encoding="utf-8")
    if recolor:
        svg = svg.replace(*recolor)
    return svg


def make_sprite(svg):
    png = resvg_py.svg_to_bytes(svg_string=svg, height=SIZE * 2)
    img = Image.open(BytesIO(bytes(png))).convert("RGBA")
    img.thumbnail((SIZE * 2, SIZE * 2), Image.LANCZOS)
    return img


def layout():
    """Spread icons over three evenly spaced rows with a small deterministic jitter."""
    rng = random.Random(30)
    positions, idx = [], 0
    for row, count in enumerate(ROWS):
        left, right = 96, W - 96
        step = (right - left) / (count - 1)
        for col in range(count):
            x = left + col * step + rng.uniform(-6, 6)
            y = ROW_Y[row] + rng.uniform(-5, 5)
            positions.append((x, y))
            idx += 1
    return positions


def backdrop():
    rng = np.random.default_rng(30)
    yy, xx = np.mgrid[0:H, 0:W]
    base = np.zeros((H, W, 3), dtype=np.float32)
    # horizontal blue -> violet gradient on a near-black canvas
    t = xx / W
    base[..., 0] = 10 + 22 * np.sin(math.pi * t)
    base[..., 1] = 12 + 10 * np.sin(math.pi * t)
    base[..., 2] = 24 + 46 * np.sin(math.pi * t)
    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for cx, cy, r, col in [(180, 60, 90, (29, 78, 216, 70)), (860, 150, 110, (96, 165, 250, 55)), (520, 110, 130, (91, 33, 182, 50))]:
        gd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=col)
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(40)))

    # faint circuit traces along the left and right edges
    d = ImageDraw.Draw(img)
    for side in (0, 1):
        for i in range(9):
            y = 14 + i * 22 + int(rng.integers(0, 6))
            length = int(rng.integers(30, 80))
            x0 = 0 if side == 0 else W
            sgn = 1 if side == 0 else -1
            d.line([(x0, y), (x0 + sgn * length, y), (x0 + sgn * (length + 14), y + 14)], fill=(180, 120, 40, 120), width=1)
            d.ellipse((x0 + sgn * (length + 14) - 2, y + 12, x0 + sgn * (length + 14) + 2, y + 16), outline=(220, 150, 50, 160))
    return img.convert("RGB")


def render_frame(bg, sprites, t, stars):
    frame = bg.convert("RGBA")
    d = ImageDraw.Draw(frame)
    for i, (sx, sy) in enumerate(stars):
        v = int((math.sin(t * 2 + i) * 0.5 + 0.5) * 180 + 60)
        d.point((sx, sy), fill=(v, v, v, 255))
    for s in sprites:
        dx = math.sin(t + s["phaseX"]) * s["ampX"]
        dy = math.cos(t + s["phaseY"]) * s["ampY"]
        angle = math.degrees(math.sin(t + s["phaseX"]) * s["rot"])
        sp = s["img"].rotate(angle, resample=Image.BICUBIC, expand=False) if abs(angle) > 0.1 else s["img"]
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        layer.paste(sp, (round(s["x"] + dx - sp.width / 2), round(s["y"] + dy - sp.height / 2)), sp)
        frame = Image.alpha_composite(frame, layer)
    return frame.convert("RGB")


def main():
    SPRITES.mkdir(parents=True, exist_ok=True)
    DOCS_ICONS.mkdir(parents=True, exist_ok=True)
    rng = random.Random(7)
    positions = layout()
    sprites, meta_icons = [], []

    for (icon_id, name, folder, variant, recolor), (x, y) in zip(ICONS, positions):
        img = make_sprite(fetch_svg(icon_id, folder, variant, recolor))
        w, h = img.size
        # sprites are stored at 2x; banner uses 1x
        small = img.resize((max(1, w // 2), max(1, h // 2)), Image.LANCZOS)
        img.save(SPRITES / f"{icon_id}.png")
        img.save(DOCS_ICONS / f"{icon_id}.png")
        grounded = icon_id in GROUNDED
        sprites.append({
            "img": small, "x": x, "y": y,
            "phaseX": rng.uniform(0, math.tau), "phaseY": rng.uniform(0, math.tau),
            "ampX": rng.uniform(0.6, 1.2) if grounded else rng.uniform(0.8, 1.8),
            "ampY": rng.uniform(0.2, 0.5) if grounded else rng.uniform(0.8, 1.8),
            "rot": 0.003 if grounded else rng.uniform(0.01, 0.025),
        })
        meta_icons.append({
            "id": icon_id, "name": name, "src": f"assets/icons/{icon_id}.png",
            "width": small.width, "height": small.height,
            "radius": max(small.width, small.height) // 2,
            "origX": round(x, 1), "origY": round(y, 1),
            "origLeft": round(x - small.width / 2, 1), "origTop": round(y - small.height / 2, 1),
            "normX": round(x / W, 4), "normY": round(y / H, 4),
            "zIndex": 3,
        })

    bg = backdrop()
    bg.save(ROOT / "assets" / "footer-backdrop.png")
    stars_rng = random.Random(11)
    stars = [(stars_rng.randint(110, W - 110), stars_rng.randint(8, H - 8)) for _ in range(30)]

    frames = []
    for i in range(24):
        frames.append(render_frame(bg, sprites, i / 24 * math.tau, stars))
    quant = [f.quantize(colors=256, method=Image.MEDIANCUT) for f in frames]

    out = ROOT / "assets"
    quant[0].save(out / "footer-physics.gif", save_all=True, append_images=quant[1:], duration=83, loop=0, optimize=True)
    frames[0].save(out / "footer-physics.webp", format="WEBP", save_all=True, append_images=frames[1:], duration=83, loop=0, quality=88, method=6)
    frames[0].save(out / "footer-physics-preview.png")
    (ROOT / "docs" / "assets").mkdir(parents=True, exist_ok=True)
    frames[0].save(ROOT / "docs" / "assets" / "footer-physics-preview.png")
    (ROOT / "docs" / "assets" / "icons-metadata.json").write_text(
        json.dumps({"bannerWidth": W, "bannerHeight": H, "icons": meta_icons}, indent=2), encoding="utf-8")
    print(f"done: {len(meta_icons)} icons, gif {(out / 'footer-physics.gif').stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
