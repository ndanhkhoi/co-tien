# Style bible — Cơ Tiên Giới

World, sects, classes and the champion roster live in `docs/world/world-bible.md`. This file is
the visual contract every generated image must follow.

## Brand look: Thuỷ Mặc (chosen)

Illustrations, icons and UI decoration are painted as Chinese/Vietnamese ink wash on warm rice paper: black ink
brushwork, grey washes, mist, generous empty paper, exactly one vermilion accent (seals, sight dots), matte, no
glow, no gold, no 3D text. Skill icons and emblems follow it (one sect accent colour allowed). Champions keep
their colourful anime look; on-table VFX use matte sect-coloured ink brushwork, without glow or additive light. Reference: `brand/thuymac` in
the master art folder.

## Look

- **Setting**: Eastern xianxia fantasy (cultivators, sects, spirit energy), every character
  wields a **billiard cue as their weapon/artifact** (styled to their sect: jade, ice, bronze, bone…).
- **Two render styles, one world**:
  - *Chibi* — 3D-render chibi (big head ~1:2 body, large expressive eyes, soft subsurface
    skin, toy-like clean materials, soft studio light). Used for portraits/avatars.
  - *Splash* — painterly 2.5D anime illustration, dynamic pose, restrained sect-colour accents,
    matte painted finish without glow. Used for splash, cut-in, menus, loading.
- **Icons & VFX** — matte painted ink magic, no glow, no metallic shine or additive light; high contrast, chunky readable silhouettes,
  readable at 48–64 px, no text.
- **Outfits**: stylish fantasy costumes may show skin (slits, bare shoulders, midriff) like typical
  xianxia/gacha art, but never sexualised or lewd: no nudity, no fetish framing, no suggestive poses.
- **Footwear**: embroidered flat cloth shoes, silk slippers, flat-soled boots or bare feet. Never high heels;
  name the footwear in a look whenever feet show, or the model adds heels to women.
- **Body variety**: not every woman is tall and long-legged. Petite, short-legged, rounded, athletic and curvy
  figures all appear; a petite adult still has an adult face and proportions.
- **State gender explicitly** in every champion look ("a man", "a woman"): without it the model drifts
  towards young women, even for kings and emperors.
- **Original designs only**: no resemblance to characters from existing works. If a result evokes a known character, reject it.
- **Never**: Latin/Chinese letters used as glyphs, text, logos, watermarks, signatures, UI frames, existing game/IP
  characters or emblems, modern clothing, guns (Thiên Cơ Các may use fantasy crossbows/cannons).

Code/shaders may render simulated objects such as balls and the table (geometry, numbers/stripes, colours, lighting and physics-driven rotation). This exception does not permit code-drawn illustrations, icons or UI decoration; those must be original assets generated through the prescribed art pipeline.

## Sect palettes (main / glow)

`glow` is the existing secondary palette field name, not permission to add luminous effects.

| sect | main | glow | motifs |
|---|---|---|---|
| thienquang | white-gold `#e9d27a` | pale blue `#9cd3ff` | flying swords, sun halo, white marble, cranes |
| huyetsat | blood red `#c1272d` | ember `#ff7a45` | black iron spikes, chains, war banners, blood moon |
| hoalinh | peach pink `#e07aa5` | jade mint `#b8f0e0` | peach blossoms, spirit foxes, wind ribbons, floating isles |
| bangphach | ice blue `#6cc4ef` | frost white `#e6fbff` | ice lotus, snowflakes, crystal palace, northern lights |
| thienco | brass `#d9a441` | electric cyan `#7fe3ff` | gears, puppets, sky lanterns, clockwork |
| docvu | toxic green `#7ccd3c` | lime `#d8ff6a` | mist, gu insects, vials, mushrooms, snakes |
| hailong | coral orange `#e0782f` | sea teal `#5fd7c8` | waves, anchors, dragon ships, gold coins |
| uminh | ghost jade `#2fd6a7` | soul silver `#9dffe3` | spirit lanterns, mist, bones, river of oblivion |
| tinhtu | star violet `#8a7cf0` | sun gold `#ffe9a3` | constellations, moon & sun discs, star maps |
| kimsa | sand gold `#e8b84a` | turquoise `#4fe0d0` | dunes, sun disc, tombs, scarabs |
| vanthu | forest green `#3fae6a` | amber `#ffb04d` | ancient trees, spirit beasts, roots, thunder birds |
| hukhong | void purple `#b44fe0` | magenta `#ff5fe0` | cracks in reality, eyes, maws, floating rocks |

## Backgrounds (so slicing works)

| asset | background to request | slice key |
|---|---|---|
| portrait (chibi avatar) | warm rice paper, matching the approved character reference | none (kept) |
| character cut-out (splash/cut-in) | **transparent** or flat pure green `#00ff00` | alpha / green |
| skill icons, emblems | warm rice paper; black ink + one sect accent, emblems vermilion + black | inspect actual background before slicing |
| VFX elements, flipbooks | transparent; matte sect ink with paper-white brush edges, no glow | alpha; normal blending |
| scenes (splash bg, menu, cut-in strip) | full scene, no transparency | none |
| table felt / rail textures | full-bleed top-down texture, seamless | none |

## Sizes delivered to the game (webp)

- portrait 256×256 · cut-out 1024 tall · splash bg 1920×1080 · menu bg 1920×1080
- skill icon 128×128 · emblem 256×256 · VFX element 256×256 · flipbook frame 256×256
- felt 1024×512 · rail 1024×128 · cue 1024×64
