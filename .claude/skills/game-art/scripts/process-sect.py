"""Turn one sect's raw generations into game-ready webp files and a review contact sheet.

    python3 process-sect.py WORK/<sect> REPO_ROOT

Reads WORK/<sect>/raw/*.png and WORK/<sect>/prompts/icons.order, writes into
REPO/public/art/{champions,skills,sects/<sect>} and WORK/<sect>/contact.png.
Missing raw files are skipped (they show as gaps on the contact sheet).
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from importlib import import_module  # noqa: E402

slicer = import_module("slice-grid")

work, repo = sys.argv[1], sys.argv[2]
sect = os.path.basename(work.rstrip("/"))
raw = os.path.join(work, "raw")
art = os.path.join(repo, "public", "art")
VFX = "circle,runes,sigil,aura,pillar,slash,cross,thrust,shock,burst,shard1,shard2,chunk,flake,spark,mist1,mist2,trail,vortex,crack,chain,talisman,motif1,motif2,orb".split(",")
EXPR = ["focus", "joy", "sad", "cast"]


def path(*p):
    full = os.path.join(art, *p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    return full


def save(im, dst, q=86):
    im.save(dst, "WEBP", quality=q, method=6)


def keyed(src):
    im = Image.open(src)
    if im.mode == "RGBA" and im.getchannel("A").getextrema()[0] < 250:
        return im
    rgb = im.convert("RGB")
    r, g, b = rgb.getpixel((4, 4))
    return slicer.green_to_alpha(rgb) if g > 180 and r < 90 and b < 90 else im.convert("RGBA")


def fit_height(im, h):
    bbox = im.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox()
    if bbox:
        im = im.crop(bbox)
    return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)


def cells(im, rows, cols, inset=0.0):
    cw, ch = im.width / cols, im.height / rows
    for r in range(rows):
        for c in range(cols):
            ix, iy = cw * inset, ch * inset
            yield im.crop((int(c * cw + ix), int(r * ch + iy), int((c + 1) * cw - ix), int((r + 1) * ch - iy)))


ids = sorted({f[4:-4] for f in os.listdir(raw) if f.startswith("cut-")})
for cid in ids:
    src = os.path.join(raw, f"cut-{cid}.png")
    save(fit_height(keyed(src), 1024), path("champions", cid, "cutout.webp"))
    if os.path.exists(os.path.join(raw, f"win-{cid}.png")):
        save(fit_height(keyed(os.path.join(raw, f"win-{cid}.png")), 1024), path("champions", cid, "win.webp"))
    if os.path.exists(os.path.join(raw, f"port-{cid}.png")):
        save(Image.open(os.path.join(raw, f"port-{cid}.png")).convert("RGB").resize((256, 256), Image.LANCZOS), path("champions", cid, "portrait.webp"))
    if os.path.exists(os.path.join(raw, f"expr-{cid}.png")):
        for name, cell in zip(EXPR, cells(Image.open(os.path.join(raw, f"expr-{cid}.png")).convert("RGB"), 2, 2)):
            save(cell.resize((256, 256), Image.LANCZOS), path("champions", cid, f"expr-{name}.webp"))

order_file = os.path.join(work, "prompts", "icons.order")
if os.path.exists(os.path.join(raw, "icons.png")) and os.path.exists(order_file):
    order = open(order_file).read().strip().split(",")
    sheet = Image.open(os.path.join(raw, "icons.png")).convert("RGB")
    for name, cell in zip(order, cells(sheet, 4, 4, inset=0.02)):
        if name == "emblem":
            # Ink seal on its own paper square (Thuỷ Mặc): kept as painted.
            save(cell.resize((256, 256), Image.LANCZOS), path("sects", sect, "emblem.webp"))
        else:
            # Skill icons keep their dark backdrop: they sit inside dark buttons.
            save(cell.resize((128, 128), Image.LANCZOS), path("skills", f"{name}.webp"))

def ink_layer(im):
    """Ink VFX come with real alpha; older glow sheets on black are keyed by brightness."""
    if im.mode == "RGBA" and im.getchannel("A").getextrema()[0] < 250:
        return im
    return slicer.black_to_alpha(im.convert("RGB"))


if os.path.exists(os.path.join(raw, "vfx.png")):
    for name, cell in zip(VFX, cells(ink_layer(Image.open(os.path.join(raw, "vfx.png"))), 5, 5)):
        save(slicer.trim_square(cell.convert("RGBA"), 0.04, 256), path("sects", sect, "vfx", f"{name}.webp"))
if os.path.exists(os.path.join(raw, "flip.png")):
    for i, cell in enumerate(cells(ink_layer(Image.open(os.path.join(raw, "flip.png"))), 4, 4)):
        save(cell.convert("RGBA").resize((256, 256), Image.LANCZOS), path("sects", sect, "flip", f"{i:02d}.webp"))
for name, w in (("splash", 1920), ("cutin", 1600)):
    if os.path.exists(os.path.join(raw, f"{name}.png")):
        im = Image.open(os.path.join(raw, f"{name}.png")).convert("RGB")
        im.thumbnail((w, w))
        save(im, path("sects", sect, f"{name}.webp"), 80)
if os.path.exists(os.path.join(raw, "rail.png")):
    im = Image.open(os.path.join(raw, "rail.png")).convert("RGB")
    save(im.resize((1024, max(64, round(1024 * im.height / im.width))), Image.LANCZOS), path("sects", sect, "rail.webp"), 82)
if os.path.exists(os.path.join(raw, "cues.png")):
    for name, cell in zip(("cue-a", "cue-b"), cells(Image.open(os.path.join(raw, "cues.png")).convert("RGB"), 2, 1)):
        k = slicer.black_to_alpha(cell)
        bbox = k.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
        if bbox:
            k = k.crop(bbox)
        save(k.resize((1024, max(16, round(1024 * k.height / k.width))), Image.LANCZOS), path("sects", sect, f"{name}.webp"))

# Contact sheet for review.
tiles = []
for cid in ids:
    for f in ("portrait.webp", "cutout.webp", "win.webp", "expr-focus.webp", "expr-joy.webp", "expr-sad.webp", "expr-cast.webp"):
        p = os.path.join(art, "champions", cid, f)
        tiles.append(p if os.path.exists(p) else None)
S = 150
cols = 7
sheet = Image.new("RGB", (cols * S + 2 * 520, max(len(ids), 1) * S), (24, 30, 44))
for i, p in enumerate(tiles):
    if not p:
        continue
    im = Image.open(p).convert("RGBA")
    im.thumbnail((S - 6, S - 6))
    sheet.paste(im, ((i % cols) * S + (S - im.width) // 2, (i // cols) * S + (S - im.height) // 2), im)
x0 = cols * S + 10
y = 0
skill_files = sorted(f for f in os.listdir(os.path.join(art, "skills")) if f.split("-")[0] in ids) if os.path.isdir(os.path.join(art, "skills")) else []
for j, f in enumerate(skill_files):
    im = Image.open(os.path.join(art, "skills", f)).convert("RGBA").resize((60, 60))
    sheet.paste(im, (x0 + (j % 8) * 64, y + (j // 8) * 64), im)
y += 2 * 64 + 6
vdir = os.path.join(art, "sects", sect, "vfx")
for j, n in enumerate(VFX):
    p = os.path.join(vdir, f"{n}.webp")
    if os.path.exists(p):
        im = Image.open(p).convert("RGBA").resize((60, 60))
        sheet.paste(im, (x0 + (j % 8) * 64, y + (j // 8) * 64), im)
y += 4 * 64 + 6
for j, n in enumerate(("emblem", "cue-a", "cue-b", "rail")):
    p = os.path.join(art, "sects", sect, f"{n}.webp")
    if os.path.exists(p):
        im = Image.open(p).convert("RGBA")
        im.thumbnail((500, 60 if n != "emblem" else 90))
        sheet.paste(im, (x0, y), im)
        y += im.height + 6
for n in ("splash", "cutin"):
    p = os.path.join(art, "sects", sect, f"{n}.webp")
    if os.path.exists(p):
        im = Image.open(p).convert("RGB")
        im.thumbnail((500, 200))
        sheet.paste(im, (x0 + 520, (0 if n == "splash" else 210)))
sheet.save(os.path.join(work, "contact.png"))
print(os.path.join(work, "contact.png"))
