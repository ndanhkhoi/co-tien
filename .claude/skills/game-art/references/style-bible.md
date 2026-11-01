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
  xianxia/gacha art, but never sexualised or lewd: no nudity, no fetish framing, no suggestive poses. The buttocks
  stay fully covered by opaque cloth (never bare or shown through sheer fabric), slits stop below the hip, no pose
  bends over or presents the rear to the viewer, no cleavage close-ups. A three-quarter back view is fine when the
  hips are fully covered and not the focus.
- **Footwear**: embroidered flat cloth shoes, silk slippers, flat-soled boots or bare feet. Never high heels;
  name the footwear in a look whenever feet show, or the model adds heels to women.
- **Exception, Ngân Cầm (`ngancam`)**: her art plays up her hips and rear and may be openly sexy: form-fitting or
  sheer silk, a slit running up to the hip that lets a little of the side and lower curve of her rear show,
  three-quarter back views, a tilted hip. No nudity: nipples and the groin are always covered, no underwear shots, no
  explicit framing.
- **Body variety**: not every woman is tall and long-legged. Petite, short-legged, rounded, athletic and curvy
  figures all appear; a petite adult still has an adult face and proportions.
- **State gender explicitly** in every champion look ("a man", "a woman"): without it the model drifts
  towards young women, even for kings and emperors.
- **Original designs only**: no resemblance to characters from existing works. If a result evokes a known character, reject it.
- **Never**: Latin/Chinese letters used as glyphs, text, logos, watermarks, signatures, UI frames, existing game/IP
  characters or emblems, modern clothing, guns (Thiên Cơ Các may use fantasy crossbows/cannons).

Code/shaders may render simulated objects such as balls and the table (geometry, numbers/stripes, colours, lighting and physics-driven rotation). This exception does not permit code-drawn illustrations, icons or UI decoration; those must be original assets generated through the prescribed art pipeline.

## Full-body checklist (cut-out, win, finisher, gallery poses, story scenes)

Prompts carry these as the body guard in `scripts/build-prompts.py`. The reviewer (a person or the lead agent, never
a delegated model) checks every numbered rule one by one on each picture, zooming into hands, feet, the cue and props;
any single failure means redraw, however good the image looks.

**Body**

1. **Limb count**: humans have two arms, two legs and five fingers per visible hand; creatures have exactly the
   limbs, wings, tails and horns their `look` lists. No extra, missing, merged or floating parts, no third leg under a
   skirt, no arm that appears from nowhere.
2. **Hands**: trace each arm from shoulder to wrist to hand. Each hand joins its own arm, is the correct left or right
   hand (thumb on the correct side), and its palm faces the way that forearm can turn. Fingers wrap around what they
   hold; nothing is pasted on the back of a hand or hovers beside the fingers.
3. **Joints**: elbows and knees bend the natural way (the front of the knee faces the toes); no limb bends where it
   has no joint; wrists and ankles do not twist past what a body can do.
4. **Feet**: two feet, a left and a right, each pointing away from the body, shoes a matching pair worn the right way
   round. Flat shoes, slippers, flat boots or bare feet with five toes; never heels.
5. **Proportion**: adults stand about seven to eight heads tall; both arms, both legs and both sides of the face match
   in length and size; hands about the length of the face; no stretched neck, torso or thigh.
6. **Face**: two eyes looking the same way, one face. No extra or ghost faces anywhere, including on fans, mirrors,
   reflections, cloth patterns, clouds or smoke.

**Physics**

7. **Support and balance**: whoever sits, kneels, leans or lies is visibly held up by the object or ground under
   them; a standing figure's weight sits over the feet unless the pose is mid-motion; nothing rests on thin air.
8. **Gravity**: hair, sleeves, tassels and cloth fall or trail consistently with the pose and one wind direction;
   liquids pour downward from the spout; cups and bowls are upright when they hold something.
9. **Occlusion**: anything hidden behind the body, an arm, hair or cloth comes out on the other side in the same line,
   angle and width. Anything worn on the back (zither, quiver, shell) stays behind the shoulders and never crosses in
   front of or through the torso or hips. No object passes through another or through the body.
10. **True scale**: props and furniture keep their real size next to the figure: chairs and railings reach their
    everyday height on the body, a cup fits in one hand, a ball is three fingers wide. A billiard table (only in
    scenes that need one) is full size: its top at a standing adult's hips, about one and a half times her height long.

**Props**

11. **One cue, held or resting**: exactly one cue, gripped by a hand (or the spec's paw/claw/tail), or lying flat or
    leaning on something solid; never floating, balanced on the body or standing on its own.
12. **The cue is a cue**: one straight, unbroken shaft about as long as the character is tall, thick decorated butt at
    one end, tapering to a ferrule and leather tip at the other. A planted cue stands on its butt, never on its tip.
    Never a brush head, orb, blade or scepter cap; nothing hangs from it unless the `look` says so.
13. **Prop count and identity**: each prop appears exactly as many times as the `look` and the pose say (one fan
    means one fan), keeps its described material and shape, and never fuses with another prop or the cue.

**Character and image**

14. **Same character**: face, hair, eyes, marks, outfit, props and cue match `look` and the cut-out.
15. **Distinct pose that acts out the brief**: the picture plainly does what the pose brief says, and every full-body
    image of a champion has its own pose and expression; never a copy of the cut-out, the win pose, the finisher or
    another gallery pose, never the generic standing pose holding the cue. Gallery poses never include a billiard table.
16. **Modesty**: buttocks and the side of the hip stay covered by opaque cloth in every pose (see Outfits above);
    Ngân Cầm is the one exception and may show a little of her rear, never nudity.
17. **Clean output**: no text, glyphs or signatures, no cropped limbs or cue, clean transparent background on
    cut-outs and poses, no scenery in gallery poses beyond the one object the pose uses.

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
