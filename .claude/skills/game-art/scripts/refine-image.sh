#!/usr/bin/env bash
# Draw one image, have it reviewed, and redraw with the reviewer's fix until it passes (at most MAX tries, default 4).
#
#   refine-image.sh OUT.png PROMPT.txt CHARACTER_REF PORTRAIT_REF SIZE CHAMPION_ID [EXTRA_REF]
#
# Writes OUT.png and OUT.review.json ({"verdict","issues","fix","tries"}). Rejected drafts move to raw/old/.
# From the third try the prompt tells the model to take only identity from the cut-out and drop its pose (the chibi
# portrait is never used: it turns faces childlike). Exit 0 only when the final verdict is "ok".
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$1"; prompt="$2"; cutref="$3"; portref="$4"; size="$5"; cid="$6"; extra="${7:-}"
max="${MAX:-4}"
old="$(dirname "$out")/old"; mkdir -p "$old"
review="${out%.png}.review.json"
work="$(mktemp -d)"; cp "$prompt" "$work/prompt.txt"
# Only the latest reviewer fix rides along: stale fixes from earlier drafts would pile up and contradict each other.

draw() {
  local ref="$1"
  local args=(--out "$out" --prompt-file "$work/prompt.txt" --ref "$ref" --size "$size" --timeout 600)
  [[ -n "$extra" ]] && args+=(--ref "$extra")
  for t in 1 2 3 4 5 6; do
    "$here/gen-image.sh" "${args[@]}" && return 0
    echo "retry draw in $((t * 30))s" >&2; sleep $((t * 30))
  done
  return 1
}

for try in $(seq 1 "$max"); do
  ref="$cutref"
  # Later tries keep the cut-out (the chibi portrait would turn faces childlike) but tell the model to drop its pose.
  # The prompt is rebuilt from the original each try, so this line is added once per try.
  [[ $try -ge 3 ]] && printf '\nUse the reference image only for the face, hair, outfit, props and cue; ignore its pose entirely.\n' >> "$work/prompt.txt"
  if [[ ! -f "$out" ]]; then draw "$ref" || { echo "draw failed: $out" >&2; exit 2; }; fi
  verdict="$("$here/review-art.sh" "$out" "$cutref" "$work/prompt.txt" "$cid")"
  v="$(jq -r .verdict <<<"$verdict" 2>/dev/null || echo error)"
  if [[ "$v" == error ]]; then
    verdict="$("$here/review-art.sh" "$out" "$cutref" "$work/prompt.txt" "$cid")"
    v="$(jq -r .verdict <<<"$verdict" 2>/dev/null || echo error)"
  fi
  jq --argjson t "$try" '. + {tries: $t}' <<<"$verdict" > "$review" 2>/dev/null || echo "$verdict" > "$review"
  echo "$(basename "$out") try $try: $v" >&2
  [[ "$v" == ok ]] && exit 0
  [[ "$v" == error ]] && exit 3
  mv "$out" "$old/$(basename "${out%.png}")-r$try.png"
  fix="$(jq -r .fix "$review")"
  cp "$prompt" "$work/prompt.txt"
  [[ -n "$fix" && "$fix" != null ]] && printf '\nReviewer fix from the previous draft (must follow): %s\n' "$fix" >> "$work/prompt.txt"
done
exit 1
