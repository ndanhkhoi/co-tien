#!/usr/bin/env bash
# Draw the Kết liễu (finishing strike) painting for the given champions into WORK/<sect>/raw/finisher-<id>.png.
#
#   gen-finishers.sh WORK_DIR id [id...]
#
# The prompt names which end of the cue strikes: the plain slim end with a white ferrule and leather tip leads to the
# lower right, and any ornament, orb, blade, hook, crest or weapon shape sits at the butt behind the rear hand. A
# champion whose look puts the ornament at the tip ("rose tip", "star tip") keeps it leading. Nothing is exported
# here: the lead reviewer checks each picture, then export-finisher.py ships the approved ones.
# Only the model cx/gpt-6-sol-image is used (through gen-image.sh).
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
work="$1"; shift
for id in "$@"; do
  sect="$(python3 -c "import json,sys;print(next(c['sect'] for c in json.load(open('$repo/src/game/content/roster.json'))['champions'] if c['id']=='$id'))")"
  dir="$work/$sect"; mkdir -p "$dir/raw" "$dir/prompts"
  cut="$dir/raw/cut-$id.png"; [[ -f "$cut" ]] || cut="$repo/public/art/champions/$id/cutout.webp"
  prompt="$dir/prompts/finisher-$id.txt"
  python3 - "$repo" "$id" > "$prompt" <<'EOF'
import json, re, sys
repo, cid = sys.argv[1], sys.argv[2]
r = json.load(open(f"{repo}/src/game/content/roster.json"))
c = next(c for c in r["champions"] if c["id"] == cid)
s = next(s for s in r["sects"] if s["id"] == c["sect"])
tip_design = re.search(r"\b(\w+(?:-\w+)?)[ -]tip(?:ped)?\b", c["look"])
human = c["kind"] in ("hiepkhach", "nuhiep")
body = ("Anatomy must be correct: exactly two arms and two legs attached to the body, five fingers on each visible hand, "
        "no extra, merged or floating limbs, knees and elbows bending the natural way.") if human else (
        "Anatomy must match the creature in the spec exactly, each limb, wing and tail attached naturally, none extra or floating.")
if tip_design:
    ends = (f"The cue's striking end is its {tip_design.group(1)} tip as the spec describes; that tip leads to the lower "
            "right, and the plain thick butt is behind the rear hand toward the upper left.")
else:
    ends = ("Which end strikes matters: the cue's plain slim end with a small white ferrule and dark leather tip is the TIP and "
            "it leads, driving toward the lower-right corner. Every ornament, orb, crest, blade, hook, anchor, sun disc, "
            "mace head or thick decorated part of the cue is at the BUTT, held behind the rear hand near the hip and pointing "
            "back toward the upper left. Never strike with the decorated or heavy end.")
print(f"""Full-body finishing-strike pose of the SAME character as the reference image (same face, species features, hair, outfit, cue and colours), painterly 2.5D anime style matching the reference: {c['name']} lunging hard along a steep diagonal from the upper left to the lower right, body stretched into a billiard thrust, both hands on one single straight cue, a thick streak of {s.get('main', 'ink')} ink brushwork trailing behind the cue tip.
{ends}
The whole cue is visible from butt to tip, one cue only, nothing hanging from it unless the spec says so.
{body} Feet in flat shoes or bare, never heels. Matte painted finish, no glow.
Character spec (every trait must match, keep every signature prop, companion and the signature cue): {c['look']}.
Whole body in frame with margin. Background: fully transparent (PNG alpha). If alpha is impossible, flat pure #00ff00 green with no shadow. No text, no letters.""")
EOF
  for t in 1 2 3 4 5 6; do
    "$here/gen-image.sh" --out "$dir/raw/finisher-$id.png" --prompt-file "$prompt" --ref "$cut" --size 1536x1024 --timeout 600 && break
    echo "retry $id in $((t * 30))s" >&2; sleep $((t * 30))
  done
  echo "drew finisher $id"
done
