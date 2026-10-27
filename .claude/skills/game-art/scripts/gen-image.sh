#!/usr/bin/env bash
# Generate one image with an external image model and save it to OUT.
#
#   gen-image.sh --tool codex|agy|api --out path/to/file.png (--prompt "..." | --prompt-file f.txt)
#                [--ref char.png] [--style-ref style.png] [--size 1024x1536] [--timeout 400]
#
# --ref       the same character to keep (face, outfit, cue).
# --style-ref rendering style to match only; its subject must not be copied.
#
# --tool api calls an OpenAI-compatible Images API (e.g. 9router) directly with curl; references
# are sent as images[] data URLs on /images/generations (9router codex models support this). Settings come from
# .env.image-api at the repo root (copy .env.image-api.example); the key never leaves that file.
# Without --size the size follows the brief: wide (16:9, 3:1, 8:1…) → 1536x1024,
# tall (9:16, full-body) → 1024x1536, otherwise square.
#
# --ref attaches reference images (same character / same style) so a set stays consistent.
#
# The prompt should describe only the picture; this script adds the "use your image tool,
# save as <name>" wrapper. Runs the tool in a throwaway directory, then moves the file to OUT.
# If the chosen tool fails, it retries once with the other tool (GEN_NO_FALLBACK=1 disables this).
set -euo pipefail

tool=codex out="" prompt="" timeout=400 size=""
refs=()
styles=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tool) tool="$2"; shift 2 ;;
    --out) out="$2"; shift 2 ;;
    --prompt) prompt="$2"; shift 2 ;;
    --prompt-file) prompt="$(cat "$2")"; shift 2 ;;
    --timeout) timeout="$2"; shift 2 ;;
    --size) size="$2"; shift 2 ;;
    --ref) refs+=("$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"); shift 2 ;;
    --style-ref) styles+=("$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"); shift 2 ;;
    *) echo "unknown arg $1" >&2; exit 2 ;;
  esac
done
[[ -n "$out" && -n "$prompt" ]] || { echo "need --out and --prompt/--prompt-file" >&2; exit 2; }

repo="$(cd "$(dirname "$0")/../../../.." && pwd)"

# A tool that ran out of quota can still leave a placeholder file; only real images count.
big_enough() {
  local wh; wh=$(magick identify -format '%w %h' "$1" 2>/dev/null) || return 1
  set -- $wh
  [[ ${1:-0} -ge 256 && ${2:-0} -ge 256 ]]
}

# How the attached images should be read, in attachment order (characters first, then styles).
ref_note() {
  local nc=${#refs[@]} ns=${#styles[@]} out=""
  [[ $nc -eq 0 && $ns -eq 0 ]] && return
  if [[ $nc -gt 0 ]]; then
    out+=$'\n'"Reference image(s) 1-$nc show THE CHARACTER: keep the same character design (face, hair, species features, outfit, colours, cue) exactly; only change what the brief asks for."
  fi
  if [[ $ns -gt 0 ]]; then
    out+=$'\n'"Reference image(s) $((nc + 1))-$((nc + ns)) are RENDERING STYLE ONLY: match their rendering, lighting, proportions and finish exactly, but do not copy their character, outfit or colours."
  fi
  printf '%s' "$out"
}

pick_size() {
  [[ -n "$size" ]] && { echo "$size"; return; }
  case "$prompt" in
    *16:9*|*"3:1"*|*"8:1"*|*"2:1"*|*"Wide "*|*"wide "*) echo 1536x1024 ;;
    *9:16*|*Full-body*|*"full-body"*) echo 1024x1536 ;;
    *) echo 1024x1024 ;;
  esac
}

# OpenAI-compatible Images API: /images/generations, or /images/edits when references are given.
run_api() {
  local env="$repo/.env.image-api"
  [[ -f "$env" ]] || { echo "fail api (missing $env — copy .env.image-api.example)" >&2; return 2; }
  # shellcheck disable=SC1090
  set -a; source "$env"; set +a
  [[ -n "${IMAGE_API_KEY:-}" && -n "${IMAGE_API_BASE:-}" ]] || { echo "fail api (IMAGE_API_BASE / IMAGE_API_KEY not set in .env.image-api)" >&2; return 2; }
  local dir; dir="$(mktemp -d)"
  local model="${IMAGE_API_MODEL:-gpt-image-1}" sz; sz="$(pick_size)"
  local bg=""
  if [[ "${IMAGE_API_TRANSPARENT:-0}" == 1 && "$prompt" == *"fully transparent"* ]]; then bg=transparent; fi
  # References ride in the generations call as data URLs (9router codex: images[] + image_detail).
  # Kept in a file: base64 images are far too long for a command-line argument.
  echo '[]' > "$dir/refs.json"
  if [[ $((${#refs[@]} + ${#styles[@]})) -gt 0 && "${IMAGE_API_EDITS:-1}" == 1 ]]; then
    for r in "${refs[@]+"${refs[@]}"}" "${styles[@]+"${styles[@]}"}"; do
      [[ -n "$r" ]] || continue
      magick "$r" -resize '1024x1024>' "png:$dir/ref.png"
      { printf 'data:image/png;base64,'; base64 < "$dir/ref.png" | tr -d '\n'; } > "$dir/ref.txt"
      jq -c --rawfile u "$dir/ref.txt" '. + [$u]' "$dir/refs.json" > "$dir/refs.tmp" && mv "$dir/refs.tmp" "$dir/refs.json"
    done
  fi
  local note; note="$(ref_note)"
  jq -n --arg m "$model" --arg p "$prompt$note" --arg s "$sz" --arg b "$bg" --arg q "${IMAGE_API_QUALITY:-}" --slurpfile refs "$dir/refs.json" \
    '{model:$m, prompt:$p, size:$s, n:1}
     + (if $b != "" then {background:$b} else {} end)
     + (if $q != "" then {quality:$q} else {} end)
     + (if ($refs[0] | length) > 0 then {images:$refs[0], image_detail:"high"} else {} end)' > "$dir/req.json"
  local code
  code=$(curl -sS -m "$timeout" -o "$dir/res.json" -w '%{http_code}' -H "Authorization: Bearer $IMAGE_API_KEY" \
    -H 'Content-Type: application/json' "${IMAGE_API_BASE%/}/images/generations?response_format=b64_json" -d @"$dir/req.json" || echo 000)
  if [[ "$code" == 200 ]]; then
    local b64 url
    b64=$(jq -r '.data[0].b64_json // empty' "$dir/res.json")
    url=$(jq -r '.data[0].url // empty' "$dir/res.json")
    if [[ -n "$b64" ]]; then
      printf '%s' "$b64" | base64 -d > "$dir/img"
    elif [[ -n "$url" ]]; then
      curl -sS -m 120 -o "$dir/img" "$url"
    fi
    if [[ -s "$dir/img" ]] && big_enough "$dir/img"; then
      mkdir -p "$(dirname "$out")"
      magick "$dir/img" "$out"
      rm -rf "$dir"
      echo "ok api $out"
      return 0
    fi
  fi
  # Error bodies never contain the key; keep them for debugging.
  echo "fail api (HTTP $code, response: $dir/res.json)" >&2
  return 1
}

run() {
  [[ "$1" == api ]] && { run_api; return; }
  local t="$1" dir name
  dir="$(mktemp -d)"
  name="image.png"
  local refnote="" i=0 codexrefs=()
  for r in "${refs[@]+"${refs[@]}"}" "${styles[@]+"${styles[@]}"}"; do
    [[ -n "$r" ]] || continue
    i=$((i + 1))
    cp "$r" "$dir/ref-$i.png"
    codexrefs+=(-i "$dir/ref-$i.png")
  done
  if [[ $i -gt 0 ]]; then
    refnote="
REFERENCE IMAGES: ref-1.png … ref-$i.png in the current directory (also attached), in this order.$(ref_note)
Do not save over the reference files."
  fi
  local full="Use your built-in image generation tool to create exactly ONE image (do not write code to draw it, do not edit files other than saving the image). Save it as the PNG file ${name} in the current directory, then reply with just the word DONE.

IMAGE BRIEF:
${prompt}${refnote}"
  (
    cd "$dir"
    if [[ "$t" == codex ]]; then
      perl -e "alarm $timeout; exec @ARGV" codex exec --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox "${codexrefs[@]+"${codexrefs[@]}"}" -- "$full" >"$dir/log.txt" 2>&1
    else
      perl -e "alarm $timeout; exec @ARGV" agy -p "$full" --dangerously-skip-permissions --add-dir "$dir" >"$dir/log.txt" 2>&1
    fi
  ) || true
  # Tools occasionally pick their own file name; take the newest image they wrote.
  local found
  found="$(ls -t "$dir"/*.png "$dir"/*.jpg "$dir"/*.webp 2>/dev/null | grep -v '/ref-[0-9]*\.png$' | head -1 || true)"
  if [[ -n "$found" ]] && big_enough "$found"; then
    mkdir -p "$(dirname "$out")"
    magick "$found" "$out"
    rm -rf "$dir"
    echo "ok $t $out"
    return 0
  fi
  echo "fail $t (log: $dir/log.txt)" >&2
  return 1
}

other=agy; [[ "$tool" == agy ]] && other=codex
[[ "$tool" == api ]] && other=codex
# A misconfigured API stops here; a failing call falls back to the other tool.
run "$tool" || { rc=$?; [[ $rc == 2 || "${GEN_NO_FALLBACK:-0}" == 1 ]] && exit 1; run "$other"; }
