#!/usr/bin/env bash
# Illustrate Cơ Tiên Truyện: one ink-wash painting per scene in src/game/content/story.json.
# Draws only scenes that are missing (REDO=1 redraws the given ones), then writes
# public/art/story/<scene>.webp.
#
#   [GEN_TOOL=api] [REDO=1] gen-story-art.sh ART_DIR [scene keys…]
#
# ART_DIR is the master-art folder that gen-sect.sh fills (ART_DIR/<sect>/raw/cut-<id>.png).
# story.json "cast" lists who appears in each scene; their cut-outs go along as references so
# every champion keeps their exact design. "vodanh" (the player) uses references/story-vodanh.webp.
# A scene whose cast has no cut-out yet is skipped with "wait" — run again once gen-sect is done.
#
# To add a chapter: add its pages (with "art" keys), the "scenes" prompts and the "cast" to
# story.json, then run this script. Raw PNGs stay in ART_DIR/story/raw.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
art="$1"; shift
work="$art/story"
mkdir -p "$work/raw" "$repo/public/art/story"
tool="${GEN_TOOL:-api}"
story="$repo/src/game/content/story.json"
keys=("$@")
if [[ ${#keys[@]} -eq 0 ]]; then
  read -r -a keys <<< "$(python3 -c "import json;print(' '.join(json.load(open('$story'))['scenes']))")"
fi
STYLE="Book illustration painted in Chinese/Vietnamese ink-wash style (thuỷ mặc) on warm rice paper: black ink brushwork, soft grey washes and mist, delicate light colour washes only on the key figures, generous empty paper, matte, no glow, cinematic composition. Wide 16:9. No text, no letters, no seals with writing."

# Prints the scene prompt, then one reference path per line (or "missing <id>").
scene_info() {
  python3 - "$repo" "$art" "$1" <<'EOF'
import json, os, sys
repo, art, key = sys.argv[1:]
story = json.load(open(f"{repo}/src/game/content/story.json"))
roster = {c["id"]: c for c in json.load(open(f"{repo}/src/game/content/roster.json"))["champions"]}
cast = story.get("cast", {}).get(key, [])
who, refs = [], []
for i, cid in enumerate(cast, 1):
    if cid == "vodanh":
        refs.append(f"{repo}/.claude/skills/game-art/references/story-vodanh.webp")
        who.append(f"reference {i} is Vô Danh, the nameless wanderer (the stranger): wide conical bamboo hat with a grey gauze veil hiding the upper face, worn grey-white robe, pale-wood cue with a cracked white jade token on a red cord")
        continue
    c = roster[cid]
    path = f"{art}/{c['sect']}/raw/cut-{cid}.png"
    if not os.path.exists(path):
        print(f"missing {cid}")
        sys.exit(0)
    refs.append(path)
    who.append(f"reference {i} is {c['name']}: {c['look']}")
cast_note = ""
if who:
    cast_note = (" Characters: " + "; ".join(who) + ". Paint each of them with exactly the design in their reference image "
                 "(face, hair style and colour, horns/ears, outfit, colours, accessories, body type), translated into the ink-wash style but clearly recognisable. "
                 "Ignore the backgrounds and the rendering style of the references.")
print(story["scenes"][key] + "." + cast_note)
print("\n".join(refs))
EOF
}

run=0
for k in "${keys[@]}"; do
  [[ -f "$work/raw/$k.png" && "${REDO:-0}" != 1 ]] && continue
  info="$(scene_info "$k")"
  if [[ "$info" == missing* ]]; then echo "wait $k (${info#missing } has no cut-out yet)"; continue; fi
  scene="$(head -n1 <<< "$info")"
  args=()
  while IFS= read -r ref; do [[ -n "$ref" ]] && args+=(--ref "$ref"); done < <(tail -n +2 <<< "$info")
  (
    tmp="$work/raw/.$k.png"
    GEN_NO_FALLBACK=1 "$here/gen-image.sh" --tool "$tool" --out "$tmp" --size 1536x1024 --timeout 600 \
      "${args[@]+"${args[@]}"}" --prompt "$STYLE Scene: $scene" && mv "$tmp" "$work/raw/$k.png"
  ) &
  run=$((run + 1))
  # Four at a time keeps the image API comfortable.
  if (( run % 4 == 0 )); then wait; fi
done
wait
python3 - "$work/raw" "$repo/public/art/story" <<'EOF'
import os, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
for f in sorted(os.listdir(src)):
    if not f.endswith(".png") or f.startswith("."):
        continue
    out = os.path.join(dst, f[:-4] + ".webp")
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(os.path.join(src, f)):
        continue
    im = Image.open(os.path.join(src, f)).convert("RGB")
    im.thumbnail((1280, 1280))
    im.save(out, "WEBP", quality=80, method=6)
    print(out)
EOF
