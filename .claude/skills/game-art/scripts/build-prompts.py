"""Write every prompt for one sect from src/game/content/roster.json.

    python3 build-prompts.py ROSTER.json SECT_ID OUT_DIR

Produces cut-<id>.txt, port-<id>.txt, win-<id>.txt, pose-<id>-<1..4>.txt (per champion) and splash.txt, cutin.txt, icons.txt,
vfx.txt, flip.txt, rail.txt, cues.txt (per sect). Icon cell order is written to icons.order.
"""
import json
import os
import sys

roster = json.load(open(sys.argv[1]))
sid = sys.argv[2]
out = sys.argv[3]
os.makedirs(out, exist_ok=True)
sect = next(s for s in roster["sects"] if s["id"] == sid)
champs = sorted((c for c in roster["champions"] if c["sect"] == sid), key=lambda c: c["tier"])
main, glow, el = sect["main"], sect["glow"], sect["element"]


# Full-body figures go wrong in the same few ways; every full-body brief carries the same guard.
# Humans follow human anatomy; creatures, spirits and constructs follow their own spec.
HUMAN_BODY = (
    "Anatomy must be correct: exactly two arms and two legs attached to the body, five fingers on each visible hand, "
    "no extra, merged or floating limbs, knees and elbows bending the natural way."
)
CREATURE_BODY = (
    "Anatomy must match the creature in the spec exactly: the same number of arms, legs, paws, wings, tails and horns "
    "the spec describes, each attached naturally to the body, none extra, merged or floating; hands, paws or claws "
    "have the digits that kind of body has."
)
COMMON = (
    "Exactly one billiard cue, straight and whole, its striking end a plain white ferrule with a small dark leather tip "
    "(only the butt may be decorated), held plausibly, never passing through the body and with nothing "
    "hanging from it unless the spec says so. Anything partly hidden behind the body, an arm, hair, wings or cloth "
    "(an instrument, the cue, a bow, a tail) continues in the same line, angle and width on both sides. "
    "Anything worn on the back (a zither, a quiver, a shell, a pack) stays strapped behind the shoulders and never "
    "crosses in front of or through the torso or hips; the cue never passes through it. "
    "Everything is drawn at true scale next to the figure: a billiard table is a full-size table whose top reaches "
    "the hips of a standing adult and whose length is about one and a half times her height (about forty ball widths; "
    "a ball is only as wide as three fingers), so a person lying on it covers about two thirds of it; chairs, stools and "
    "railings fit an adult body. "
    "Anyone wearing shoes wears completely flat shoes or boots with zero heel height, the whole sole on the ground, never heels of any size."
)


# Gallery poses stay modest; only Ngân Cầm may play up her hips and rear (style bible exception).
MODEST = (
    "Modest framing: the buttocks are always fully covered by opaque cloth, never bare, never outlined through sheer or "
    "wet fabric; skirt slits stop below the hip; no pose bends over or turns the rear towards the viewer; no cleavage "
    "close-up. Shoulders, arms, midriff and legs may show as the costume describes."
)
SHOWCASE = (
    "Her figure is the appeal: opaque silk hugging her hips and rear, a tilted hip and an over-the-shoulder glance, "
    "always fully clothed, no nudity, no underwear, nothing explicit."
)


def modesty(c):
    return SHOWCASE if c["id"] == "ngancam" else MODEST


def body(c):
    return (HUMAN_BODY if c["kind"] in ("hiepkhach", "nuhiep") else CREATURE_BODY) + " " + COMMON


def w(name, text):
    with open(os.path.join(out, name), "w") as f:
        f.write(text.strip() + "\n")


for c in champs:
    w(f"cut-{c['id']}.txt", f"""
Full-body character illustration, painterly 2.5D anime style, Eastern xianxia fantasy game splash art.
Character: {c['name']}, {c['look']}. The billiard cue is their weapon and cultivation artifact, styled in the
{sect['name']} sect's look ({sect['motifs']}).
Stylish costume, tasteful and non-sexualised. Dynamic pose: {c['pose']}, slightly 3/4 view, whole body in frame
with margin, rim light in {glow} and {main}, a few {el} particles close to the body.
{body(c)}
Background: fully transparent (PNG alpha). If alpha is impossible, flat pure #00ff00 green with no shadow.
No text, no logo, no frame, no letters.
""")
    w(f"port-{c['id']}.txt", f"""
Chibi 3D-render game avatar of the same character as the reference image: head and shoulders, big head,
large expressive eyes, soft subsurface skin, toy-like clean materials, soft studio lighting, {c['expr']}.
Keep the face, species features, hair, outfit colours and accessories of the reference exactly.
Character spec (every visible trait must match): {c['look']}.
Square 1:1, face centred and filling about 70% of the frame. Background: warm off-white rice paper with a soft
ink-wash halo behind the head tinted with {main} (a pale wash, not a solid colour), nothing else. No text.
""")

    w(f"expr-{c['id']}.txt", f"""
An expression sheet laid out as an exact 2x2 grid of 4 equal square cells, each showing the SAME chibi
3D-render character as the reference image (same face, species features, hair, outfit and accessories),
head and shoulders, centred, same scale in every cell. No text, no grid lines. Background of every cell:
warm off-white rice paper with a soft ink-wash halo tinted with {main}.
Character spec (every visible trait must match, including eye colour, marks and the signature cue): {c['look']}.
Cell 1 (top-left): focused and calm, looking down at the table, chin resting near their own signature billiard cue exactly as described in the spec (no plain wooden cue, no bow, no other weapon).
Cell 2 (top-right): overjoyed, cheering, sparkles.
Cell 3 (bottom-left): frustrated / annoyed after a mistake, sweat drop.
Cell 4 (bottom-right): casting a skill, glowing {el} in the eyes and around a raised hand.
At most one cue in any cell, never two; hands, paws or claws keep the digits of the character's kind.
""")
    w(f"win-{c['id']}.txt", f"""
Full-body victory pose of the SAME character as the reference image (same face, species features, hair,
outfit, cue and colours), painterly 2.5D anime style matching the reference: {c['name']} celebrating a won
billiards match — triumphant, cue raised or resting on the shoulder, {c['expr']}, burst of {el} behind.
Character spec (every trait must match, keep every signature prop, companion and the signature cue): {c['look']}.
The victory pose is clearly different from the reference pose: relaxed and celebratory, never the same attack stance.
{body(c)}
Whole body in frame with margin, rim light in {glow}. Background: fully transparent (PNG alpha).
If alpha is impossible, flat pure #00ff00 green with no shadow. No text, no letters.
""")
    if "gallery" in c:
        for idx, g in enumerate(c["gallery"]):
            n = idx + 1
            g_pose = g["pose"].strip().rstrip(".")
            # A pose spread along a long object (lying on a billiard table) needs a wide canvas to keep true scale.
            frame_text = "wide horizontal 1536x1024 composition" if g.get("frame") == "wide" else "vertical 1024x1536 composition"
            w(f"pose-{c['id']}-{n}.txt", f"""
Full-body character illustration of the SAME character as the reference image (same face, species features, hair, outfit, cue and colours), painterly 2.5D anime splash style matching the reference: {c['name']}.
The billiard cue is their weapon and cultivation artifact, styled in the {sect['name']} sect's look ({sect['motifs']}).
Character spec (every trait must match, keep every signature prop, companion and the signature cue): {c['look']}.
This pose is clearly different from the reference pose: {g_pose}.
Paint only the character (and companion), plus at most the one object the pose sits, leans or works on; any place named in the pose is mood only, never painted: no scenery, architecture, sky, moon, lanterns or floor beyond a small cast shadow. If the cue is not in a hand it rests visibly on that object or lies flat on the ground, never standing or floating on its own. Never fall back to a plain standing pose holding the cue upright beside the body unless the pose asks for it: act out the pose with the whole body.
{body(c)}
{modesty(c)}
Whole body in frame with margin, {frame_text}, rim light in {glow} and {main}.
Background: fully transparent (PNG alpha). If alpha is impossible, flat pure #00ff00 green with no shadow.
No text, no logo, no frame, no letters.
""")

# Kết liễu animation: eight keyframes of one strike, all on the same canvas so they play back without jumping.
FINISH_FRAMES = [
    "ready: standing poised at the left of the frame, eyes narrowing on the lower right, the cue held low and level",
    "coil: sinking low onto the back foot, body turned and coiled, the cue drawn far back along the body",
    "launch: pushing off hard from the back foot, the body tipping forward, the cue starting to come through",
    "lunge: airborne and stretched along the diagonal from upper left to lower right, the cue driving forward",
    "thrust: almost at full reach, front arm extending, the cue tip a little short of the lower-right corner",
    "impact: full extension at the instant of the strike, front arm locked, the cue tip at the lower-right corner, a burst of ink at the tip",
    "follow-through: momentum carrying the body past the strike, the cue swinging up and across the body",
    "finish: landed toward the right of the frame and poised, the cue resting on the shoulder or held upright, a cool victorious glance back",
]

for c in champs:
    for i, phase in enumerate(FINISH_FRAMES):
        w(f"fin-{c['id']}-{i + 1}.txt", f"""
Keyframe {i + 1} of 8 of one finishing strike by the SAME character as the first reference image (same face, species features, hair, outfit, cue and colours), painterly 2.5D anime style matching it: {c['name']}.
Phase: {phase}.
Use the second reference image only for framing: same wide canvas, same character scale, same ground line, the whole action moving from left to right across the frame; do not copy its pose.
Character spec (every trait must match, keep every signature prop, companion and the signature cue): {c['look']}.
The cue is one single straight cue: slim tip toward the strike direction, thick butt behind the rear hand. A streak of {main} ink brushwork only where the phase mentions ink.
{body(c)}
{modesty(c)}
Whole body in frame with margin, wide 1536x1024 composition, matte painted finish, no glow.
Background: fully transparent (PNG alpha). If alpha is impossible, flat pure #00ff00 green with no shadow.
No text, no logo, no frame, no letters.
""")

w("splash.txt", f"""
Wide 16:9 landscape painting in Chinese/Vietnamese ink-wash painting (thuỷ mặc) on warm rice paper: black ink brushwork, soft grey washes and mist, with only a faint wash of {main} for this land: the {sect['name']} sect —
{sect['motifs']}. An ancient stone billiard table stands small on a terrace in the mid-ground. Generous empty paper,
matte and calm, no glow. No characters, no text, no letters, no seals with writing. Leave the left third calmer for UI.
""")
w("cutin.txt", f"""
Wide 3:1 background for a skill cut-in: one huge diagonal black ink brush stroke sweeping from lower-left to upper-right
across warm rice paper, dry-brush edges and ink splatter, with a single wash of {main} bleeding into the stroke and a few
{el} motifs painted in ink. Matte, no glow, no characters, no text.
""")
cells = []
order = []
for c in champs:
    for i, s in enumerate(c["skills"]):
        cells.append(s["icon"])
        order.append(f"{c['id']}-{'12u'[i]}")
cells.append(f"the sect emblem as a square seal stamp printed only in vermilion red and black ink (no other colours, no metal, no shine): {sect['emblem']}")
order.append("emblem")
w("icons.order", ",".join(order))
w("icons.txt", "A sprite sheet laid out as an exact 4x4 grid of 16 equal square cells. Each cell contains exactly one "
  "centred game ability icon painted in Chinese/Vietnamese ink-wash style: bold black ink brushwork with grey washes and "
  f"one accent colour {main}, on a flat warm rice-paper square, matte, no glow, no light rays, no metallic shine, no white "
  "highlights, no glossy 3D volume, no colours other than ink and the accent; chunky silhouettes readable at 48px; "
  "no borders, no grid lines, no text, no letters. Cells, row by row:\n"
  + "\n".join(f"{i + 1} {t};" for i, t in enumerate(cells)))
w("vfx.txt", f"""
A VFX sprite sheet laid out as an exact 5x5 grid of 25 equal square cells, each holding ONE isolated effect element
centred with padding, painted as Chinese ink-brush strokes in coloured ink {main} with black ink accents and thin
paper-white dry-brush edges, matte (no glow, no light rays), so it reads on a dark billiard cloth. Background fully
transparent (PNG alpha). No text, no letters, no grid lines. Cells row by row:
row1: ink ensō circle (top-down), thin brushed ring of small ink dots, abstract brush sigil (not a letter), soft ink halo ring, vertical ink brush stroke rising
row2: curved brush slash, two crossing brush slashes, straight thrust brush stroke, ink shockwave ring of splatter, star-shaped ink splash burst
row3: ink shard stroke 1, ink shard stroke 2, chunky ink blot, small petal/flake of ink, tiny ink spark dot cluster
row4: ink mist puff 1, ink mist puff 2, horizontal flowing ink ribbon, top-down ink swirl vortex, cracked-ink pattern
row5: brushed ink chain segment, a paper talisman with ink brush marks (no readable writing), sect motif ({sect['motifs'].split(',')[0]}) in ink, sect motif ({sect['motifs'].split(',')[1].strip()}) in ink, small soft ink orb
""")
w("flip.txt", f"""
An animation flipbook laid out as an exact 4x4 grid of 16 equal square cells, read left-to-right, top-to-bottom: a single
drop of {main} coloured ink falls (cell 1), splashes and blooms outward into an ink painting of {sect['emblem']} (cells 2-9),
holds at full bloom with crisp brush edges (cells 10-11), then dissolves into ink mist and drifting drops that fade out
(cells 12-16). Same camera, same centre and scale in every cell, top-down, matte ink with paper-white edges, no glow,
no bright white symbols, no saturated solid fills — irregular ink blooms with broken brush edges.
Background fully transparent (PNG alpha). No text, no grid lines.
""")
w("rail.txt", f"""
Top-down seamless horizontal strip texture of a billiard table rail top in Chinese/Vietnamese ink-wash style:
dark ink-washed wood with fine dry-brush grain, a subtle carved {sect['motifs'].split(',')[0]} motif painted in ink,
muted greys and warm browns with at most a faint hint of {main}, matte, soft paper-like texture, no gloss,
even lighting, no perspective, no objects, no text, fills the whole frame edge to edge, very wide 8:1.
""")
w("cues.txt", f"""
Two ornate billiard cues, perfectly horizontal side view, each spanning the full image width, tip on the LEFT,
butt on the right, stacked one above the other with lots of empty space between them, on pure black #000000,
no text. Realistic cue proportions: long slim shaft with white ferrule and blue chalked tip, thicker decorated butt.
Cue A (top): {sect['cues'][0]}. Cue B (bottom): {sect['cues'][1]}.
""")
print(out)
