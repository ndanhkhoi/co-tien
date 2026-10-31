#!/usr/bin/env bash
# Review one generated image with Codex vision against the full-body checklist; prints a JSON verdict.
#
#   review-art.sh IMAGE CHARACTER_REF PROMPT_FILE [CHAMPION_ID]
#
# IMAGE is the picture under review, CHARACTER_REF the approved cut-out, PROMPT_FILE the prompt it was drawn from.
# Output (stdout): {"verdict":"ok"|"redraw","issues":["..."],"fix":"one English sentence to add to the prompt"}
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
img="$1"; ref="$2"; prompt="$3"; cid="${4:-}"
tmp="$(mktemp -d)"
# Codex reads PNG/JPEG; flatten on grey so transparent cut-outs stay readable.
magick "$img" -background '#9a9a9a' -alpha remove -resize '1400x1400>' "$tmp/image.jpg"
magick "$ref" -background '#9a9a9a' -alpha remove -resize '900x900>' "$tmp/ref.jpg"
cat > "$tmp/schema.json" <<'JSON'
{"type":"object","additionalProperties":false,"required":["verdict","issues","fix"],
 "properties":{"verdict":{"type":"string","enum":["ok","redraw"]},
 "issues":{"type":"array","items":{"type":"string"}},"fix":{"type":"string"}}}
JSON
modesty="Modesty: buttocks and the side of the hip fully covered by opaque cloth (not visible through sheer fabric, and not opened up by a slit in a lunge, leap or kick: check those poses closely), slits stop below the hip, no pose that bends over or presents the rear to the viewer, no cleavage close-up. A three-quarter back view is fine when the hips are fully covered and not the focus."
[[ "$cid" == "ngancam" ]] && modesty="Modesty: this is Ngân Cầm, the one allowed exception. Her high side slit, low open back and poses that play up her hips and rear are her design, not defects. She must stay fully clothed: no nudity, no underwear showing."
checklist="$(sed -n '/^## Full-body checklist/,/^## Sect palettes/p' "$here/../references/style-bible.md")"
cat > "$tmp/ask.txt" <<EOF
You are a strict art reviewer for a billiards game. Image 1 is the approved character reference (cut-out). Image 2 is the
new picture to review. It was drawn from this prompt:
---
$(cat "$prompt")
---
Check image 2 against every rule below and against the prompt. Look closely (hands, fingers, feet, the whole cue from butt
to tip, anything worn on the back, any billiard table: its size against the body, straight parallel rails, a flat felt,
pockets are holes cut into the table top at its corners and the middles of the long rails, never on a leg or the side
apron (a table only partly in frame need not show every pocket or its whole length; judge the parts that are visible);
measure the table against the figure with the balls as a ruler: a ball is 5.7 cm, about three fingers wide; a
full table is 2.2 to 2.5 m long (about forty balls) and 80 cm high, so an adult lying on it covers only about two thirds of
its length, and its top reaches a standing adult's hip; net or basket pockets hanging just under a corner or mid-rail pocket are correct, and reaching into one to take out a ball is right; balls rest on the felt; a cue lying on the table lies flat on it; the table's legs, rails and felt
join up in one consistent perspective).
Both images were flattened onto plain grey by the review tool: ignore the grey background, it is not a defect.
$checklist
$modesty A childlike or young-looking character is never posed suggestively.
Judge the cue by whether it reads as one billiard cue at a glance (tapered toward a tip, butt may be decorated); do
not fail it for a small cap or ornament you have to squint at.
Zoom in on every limb: knees and elbows must bend the natural way (the front of the knee faces the same way as the
toes), feet must point away from the body with shoes worn the right way round.
Describe the figure's actual pose to yourself before comparing it with the prompt, so you do not misread it. Minor
ribbons or train touching the frame edge are fine; limbs, the cue and props must not be cut off. Report only what you can see. verdict "redraw" if any rule is broken or the picture does not clearly act out the prompt's
pose; a generic standing pose holding the cue upright (like the reference) fails unless the prompt asks for it.
issues: short concrete findings (what and where). fix: one English sentence of extra prompt instructions that would
avoid those issues, or "" when ok.
EOF
codex exec --skip-git-repo-check -s read-only -C "$tmp" -c model_reasoning_effort=high \
  --output-schema "$tmp/schema.json" -o "$tmp/out.json" -i "$tmp/ref.jpg" -i "$tmp/image.jpg" - < "$tmp/ask.txt" >"$tmp/log.txt" 2>&1
if [[ -s "$tmp/out.json" ]]; then cat "$tmp/out.json"; else echo '{"verdict":"error","issues":["review failed: see '"$tmp"'/log.txt"],"fix":""}'; fi
