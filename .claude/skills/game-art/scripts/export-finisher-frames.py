"""Export the eight Kết liễu keyframes onto one shared stage so playback never jumps.

    python3 export-finisher-frames.py RAW_DIR DEST_DIR CHAMPION_ID

The model draws each frame at its own size and spot, so every frame is trimmed and re-placed here: the figure's
height follows a fixed rhythm (upright 1.0, coiled and lunging lower), its feet stand on one ground line and its
centre slides evenly from left to right across the 1152×768 stage.
"""
import os
import sys

from PIL import Image

raw, dst, cid = sys.argv[1:4]
W, H = 1152, 768
GROUND = H - 24
TALL = H * 0.86
# Height share of an upright figure, and the figure's centre as a share of the stage width, per frame.
HEIGHT = [1.0, 0.82, 0.86, 0.78, 0.8, 0.8, 0.88, 1.0]
CENTRE = [0.24, 0.28, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74]


def figure(src):
    im = Image.open(src).convert("RGBA")
    if im.getchannel("A").getextrema()[0] >= 250:
        im.putdata([(r, g, b, 0 if g > 180 and r < 90 and b < 90 else 255) for r, g, b, _ in im.getdata()])
    box = im.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
    return im.crop(box) if box else im


os.makedirs(dst, exist_ok=True)
for n in range(1, 9):
    src = os.path.join(raw, f"fin-{cid}-{n}.png")
    if not os.path.exists(src):
        continue
    fig = figure(src)
    h = TALL * HEIGHT[n - 1]
    scale = min(h / fig.height, (W * 0.9) / fig.width)
    fig = fig.resize((max(1, round(fig.width * scale)), max(1, round(fig.height * scale))), Image.LANCZOS)
    stage = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    x = round(W * CENTRE[n - 1] - fig.width / 2)
    x = max(0, min(W - fig.width, x))
    stage.alpha_composite(fig, (x, GROUND - fig.height))
    stage.save(os.path.join(dst, f"fin-{n}.webp"), "WEBP", quality=72, method=6)
print(f"exported finisher frames for {cid}")
