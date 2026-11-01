#!/usr/bin/env bash
# Draw gallery poses two at a time and cut them apart for review.
#
#   gen-gallery.sh SECT_ID WORK_DIR [ids...]
#
# Each champion has two sheets (a: poses 1-2, b: poses 3-4), each one 1536x1024 call with one figure per half.
# A sheet is drawn only when one of its poses is not yet approved (pose-<id>-<n>.review.json says "ok" from mark-pose.py); the cut
# halves land in WORK/<sect>/raw/pose-<id>-<n>.png, never over an approved pose. WORK/<sect>/fix/<id>-<a|b>.txt, when
# present, is appended to that sheet's prompt (what to correct after a rejected draw).
# Review is done by a person (or the lead agent) with mark-pose.py; export-gallery.py then ships the approved poses.
# Only the model cx/gpt-6-sol-image is used (through gen-image.sh).
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
sect="$1"; work="$2/$sect"; shift 2
mkdir -p "$work/raw" "$work/prompts" "$work/sheets" "$work/fix"
python3 "$here/build-prompts.py" "$repo/src/game/content/roster.json" "$sect" "$work/prompts" >/dev/null

ids=("$@")
if [[ ${#ids[@]} -eq 0 ]]; then
  read -r -a ids <<< "$(python3 -c "import json;print(' '.join(c['id'] for c in json.load(open('$repo/src/game/content/roster.json'))['champions'] if c['sect']=='$sect'))")"
fi
# Only a review written by mark-pose.py (reviewer "lead") approves a pose.
approved() { [[ -f "$work/raw/pose-$1.png" && "$(jq -r '.verdict + "/" + (.reviewer // "")' "$work/raw/pose-$1.review.json" 2>/dev/null)" == ok/lead ]]; }

for id in "${ids[@]}"; do
  cut="$work/raw/cut-$id.png"; [[ -f "$cut" ]] || cut="$repo/public/art/champions/$id/cutout.webp"
  [[ -f "$cut" ]] || { echo "skip $id (missing cut-out)" >&2; continue; }
  for half in a b; do
    if [[ $half == a ]]; then l=1; r=2; else l=3; r=4; fi
    approved "$id-$l" && approved "$id-$r" && continue
    sheet="$work/sheets/sheet-$id-$half.png"
    if [[ ! -f "$sheet" ]]; then
      prompt="$(mktemp)"; cp "$work/prompts/sheet-$id-$half.txt" "$prompt"
      [[ -f "$work/fix/$id-$half.txt" ]] && { printf '\nCorrect these faults from the previous draw: '; cat "$work/fix/$id-$half.txt"; } >> "$prompt"
      # The image API rate-limits (HTTP 429, resets within a minute): wait and retry instead of skipping.
      for t in 1 2 3 4 5 6; do
        if "$here/gen-image.sh" --out "$sheet" --prompt-file "$prompt" --ref "$cut" --size 1536x1024 --timeout 600; then
          # A sheet must hold two figures side by side; a single portrait-shaped figure would be cut in half.
          read -r w h <<< "$(magick identify -format '%w %h' "$sheet")"
          (( w * 10 >= h * 13 )) && break
          echo "sheet $id $half came back ${w}x${h}, not two figures: drawing again" >&2
          rm -f "$sheet"; continue
        fi
        echo "retry $id sheet $half in $((t * 30))s" >&2; sleep $((t * 30))
      done
    fi
    [[ -f "$sheet" ]] || continue
    approved "$id-$l" || magick "$sheet" -crop 50%x100%+0+0 +repage "$work/raw/pose-$id-$l.png"
    approved "$id-$r" || magick "$sheet" -gravity east -crop 50%x100%+0+0 +repage "$work/raw/pose-$id-$r.png"
    echo "drew $id sheet $half"
  done
done
echo "Gallery sheets ready for review in $work/sheets"
