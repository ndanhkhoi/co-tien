#!/usr/bin/env bash
# Generate all raw art for one sect into WORK/<sect>/raw (skips files that already exist).
#
#   [GEN_CHAR_TOOL=codex|agy|api] [GEN_REF_TOOL=codex|agy] [GEN_SHEET_TOOL=agy|codex|api] gen-sect.sh SECT_ID WORK_DIR
#
# GEN_REF_TOOL draws the images that must match a reference (portrait, victory, expressions);
# it defaults to GEN_CHAR_TOOL and must support reference images.
#
# Champion cut-outs go first (codex, alpha); the chibi portrait and victory pose then use the
# cut-out as reference, and the 2x2 expression sheet uses the portrait. Scene, icon, VFX, flipbook, rail and cue sheets run on agy in parallel.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
sect="$1"; work="$2/$sect"; shift 2
mkdir -p "$work/raw" "$work/prompts"
python3 "$here/build-prompts.py" "$repo/src/game/content/roster.json" "$sect" "$work/prompts" >/dev/null
G="$here/gen-image.sh"
# Fixed style anchors so every sect matches the approved look. The expression sheet skips them:
# its portrait reference is already on-style, and a human style anchor gets copied onto
# non-human champions.
SP="$here/../references/style-portrait.png"
SC="$here/../references/style-cutout.png"
CT="${GEN_CHAR_TOOL:-codex}"
RT="${GEN_REF_TOOL:-$CT}"
ST="${GEN_SHEET_TOOL:-agy}"
want() { [[ ! -f "$work/raw/$1" ]]; }

ids=$(python3 -c "import json,sys;print(' '.join(c['id'] for c in json.load(open('$repo/src/game/content/roster.json'))['champions'] if c['sect']=='$sect'))")
for id in $ids; do
  (
    want "cut-$id.png" && $G --tool "$CT" --out "$work/raw/cut-$id.png" --prompt-file "$work/prompts/cut-$id.txt" --style-ref "$SC" --timeout 600
    want "port-$id.png" && [[ -f "$work/raw/cut-$id.png" ]] && $G --tool "$RT" --out "$work/raw/port-$id.png" --prompt-file "$work/prompts/port-$id.txt" --ref "$work/raw/cut-$id.png" --style-ref "$SP" --timeout 600
    want "win-$id.png" && [[ -f "$work/raw/cut-$id.png" ]] && $G --tool "$RT" --out "$work/raw/win-$id.png" --prompt-file "$work/prompts/win-$id.txt" --ref "$work/raw/cut-$id.png" --style-ref "$SC" --timeout 600
    want "expr-$id.png" && [[ -f "$work/raw/port-$id.png" ]] && $G --tool "$RT" --out "$work/raw/expr-$id.png" --prompt-file "$work/prompts/expr-$id.txt" --ref "$work/raw/port-$id.png" --timeout 600
  ) &
done
for x in splash cutin icons vfx flip rail cues; do
  want "$x.png" && $G --tool "$ST" --out "$work/raw/$x.png" --prompt-file "$work/prompts/$x.txt" --timeout 600 &
done
wait
ls "$work/raw"
