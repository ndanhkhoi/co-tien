# Prompt templates

Fill the `{…}` slots from `docs/world/world-bible.md` and the palette table in `style-bible.md`.
Keep the fixed sentences verbatim: they are what keeps 60 champions looking like one game.

## Character cut-out (do this FIRST for each champion; it is the reference for the rest)

```
Full-body character illustration, painterly 2.5D anime style, Eastern xianxia fantasy game splash art.
Character: {name}, {gender/age}, {look}. Wields a billiard cue styled as a {sect material} cultivation
artifact. Stylish costume, tasteful and non-sexualised. Dynamic {class pose: archer aiming / warrior swinging / mage casting / guardian bracing /
assassin lunging / hexer channelling / time-mage weaving} pose, slightly 3/4 view, whole body in frame
with margin, rim light in {glow hex} glow. Background: fully transparent (PNG alpha). If alpha is
impossible, flat pure #00ff00 green with no shadow. No text, no logo, no frame.
```
Generate through 9router with a transparent background. Slice: none; key with `--key alpha` (or `green`) through `slice-grid.py --rows 1 --cols 1 --trim --size 1024`.

## Chibi portrait (avatar) — pass the cut-out as `--ref`

```
Chibi 3D-render game avatar of the same character as the reference: head and shoulders, big head,
large expressive eyes, soft subsurface skin, toy-like clean materials, soft studio lighting,
{expression}. Square 1:1, face centred and filling ~70% of the frame. Background: soft radial gradient
from {main hex} to dark navy #101a2e, nothing else. No text.
```

## Sect splash / cut-in background (one per sect)

```
Wide 16:9 painterly xianxia environment, {sect} — {motifs}. A grand stone/jade billiard table
platform ("spirit table") in the {mid-ground}, dramatic light, palette {main hex} with {glow hex}
highlights, empty of characters, no text. Leave the left third calmer for UI.
```
Cut-in strip variant: `Wide 3:1 abstract dynamic background for a skill cut-in: diagonal speed streaks and swirling {sect element} energy in {main hex}/{glow hex} over deep navy, no characters, no text.`

## Skill icons — one 4x4 sheet per sect (15 skills + emblem)

```
A sprite sheet laid out as an exact 4x4 grid of 16 equal square cells. Each cell contains exactly one
centred xianxia game ability icon with generous padding; no borders, no grid lines, no text.
Background pure black #000000. Painterly glowing magic, high contrast, chunky silhouettes readable at
64px, palette {main hex}/{glow hex}. Cells, row by row:
1 {skill concept} · 2 … · 15 {skill concept} · 16 the {sect} emblem: {emblem concept}.
```
Slice: `--rows 4 --cols 4 --key black --trim --size 128` (emblem re-cut at 256).

## VFX elements — one 5x5 sheet per sect (animated in Pixi)

```
A VFX sprite sheet laid out as an exact 5x5 grid of 25 equal square cells, each holding ONE isolated
visual effect element centred with padding, on pure black #000000 (for additive blending), no text,
no grid lines. Glowing {element} energy in {main hex}/{glow hex}. Cells row by row:
row1: magic circle seal (top-down, symmetric), rune ring (thin), abstract sigil glyph (geometric, not a letter), aura ring, light pillar (vertical)
row2: slash arc, double slash cross, thrust streak, shockwave ring, impact star burst
row3: {element} shard 1, {element} shard 2, {element} chunk, petal/flake particle, sparkle particle
row4: smoke/mist puff 1, mist puff 2, trail ribbon (horizontal), swirl vortex (top-down), crack/shatter pattern
row5: chain segment, talisman/charm, {sect motif} 1, {sect motif} 2, soft glow orb
```
Slice: `--rows 5 --cols 5 --key black --trim --size 256`. Element ids (row-major):
`circle,runes,sigil,aura,pillar,slash,cross,thrust,shock,burst,shard1,shard2,chunk,flake,spark,mist1,mist2,trail,vortex,crack,chain,talisman,motif1,motif2,orb`.

## Flipbook (optional, for a signature ultimate)

```
An animation flipbook laid out as an exact 4x4 grid of 16 equal square cells, read left-to-right,
top-to-bottom, showing ONE {effect, e.g. ice lotus blooming then shattering} from first spark (cell 1)
to fade-out (cell 16), same camera, same centre and scale in every cell, on pure black #000000,
no text, no grid lines.
```
Slice: `--rows 4 --cols 4 --key black --size 256` (no `--trim`: frames must keep their registration).

## Table & cue textures

```
Seamless top-down texture of billiard table cloth for {sect}: {felt colour} wool felt with a subtle
woven {motif} pattern, even lighting, no perspective, no objects, fills the whole frame.
```
```
Top-down seamless strip texture of a billiard table rail for {sect}: {material}, ornate {motif}
carving, even lighting, fills the frame, wide 8:1.
```
```
Two ornate billiard cues for {sect}, perfectly horizontal side view, each spanning the full width,
stacked with space between, tip on the right, on pure black #000000, no text. Cue A: {desc}. Cue B: {desc}.
```
Slice cues with `--rows 2 --cols 1 --key black`, then crop to 16:1.

## Menu / key art

```
Key art for a xianxia billiards game: {scene}, cinematic, painterly 2.5D anime, palette navy #101a2e
with scoreboard yellow #ffc531 accents, empty space {where} for the logo and buttons, no text.
```
