#!/usr/bin/env bash
# Generate one image through 9router and save it to OUT.
#
#   gen-image.sh --out path/to/file.png (--prompt "..." | --prompt-file f.txt)
#                [--ref char.png] [--style-ref style.png] [--size 1024x1536] [--timeout 400]
#
# --ref keeps the character design; --style-ref matches rendering without copying its subject.
# Configure .env.image-api from .env.image-api.example. Requests use cx/gpt-6-sol-image
# on /images/generations, with reference images attached as images[] data URLs.
# Without --size, wide briefs use 1536x1024, full-body briefs use 1024x1536,
# and other briefs use 1024x1024. Failed requests return a nonzero exit status.
set -euo pipefail

out="" prompt="" timeout=400 size=""
refs=()
styles=()
while [[ $# -gt 0 ]]; do
  case "$1" in
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

# Accept only real images with usable dimensions.
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

# 9router Images API, including reference images in the generation request.
run_api() {
  local env="$repo/.env.image-api"
  [[ -f "$env" ]] || { echo "fail api (missing $env — copy .env.image-api.example)" >&2; return 2; }
  # shellcheck disable=SC1090
  set -a; source "$env"; set +a
  [[ -n "${IMAGE_API_KEY:-}" && -n "${IMAGE_API_BASE:-}" ]] || { echo "fail api (IMAGE_API_BASE / IMAGE_API_KEY not set in .env.image-api)" >&2; return 2; }
  local model="${IMAGE_API_MODEL:-cx/gpt-6-sol-image}" sz
  [[ "$model" == cx/gpt-6-sol-image ]] || { echo "IMAGE_API_MODEL must be cx/gpt-6-sol-image" >&2; return 2; }
  sz="$(pick_size)"
  local dir; dir="$(mktemp -d)"
  local bg=""
  if [[ "${IMAGE_API_TRANSPARENT:-0}" == 1 && "$prompt" == *"fully transparent"* ]]; then bg=transparent; fi
  # References ride in the generations call as data URLs (9router: images[] + image_detail).
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

run_api
