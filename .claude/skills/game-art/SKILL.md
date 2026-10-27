---
name: game-art
description: Generate original Cơ Tiên game art (champion cut-outs, chibi portraits, splash and menu art, skill icons, sect emblems, VFX element sheets, flipbooks, table felt/rail and cue textures) with the codex or agy image models, then slice, key and export them as webp into public/art. Use whenever the game needs a new or redrawn image asset.
---

# Game art pipeline

All art is generated, never downloaded: no third-party game characters, names or emblems.
Read before generating:

- `docs/world-bible.md` — sects, classes, champions, skills (what to draw)
- `references/style-bible.md` — look, palettes, backgrounds, delivery sizes (how it must look)
- `references/prompt-templates.md` — fixed prompt blocks per asset type

## Tools

| script | does |
|---|---|
| `scripts/gen-image.sh --tool codex\|agy --out f.png --prompt-file p.txt [--ref r.png]` | one image via the external model; falls back to the other tool on failure |
| `scripts/rebackground.sh WORK SECT [ids]` | repaint only the background of portraits / expression sheets (old files → `raw/old/`); skips images already on paper |
| `scripts/gen-story-art.sh WORK [scenes]` | illustrations for Cơ Tiên Truyện from `story.json` → `public/art/story/` (only missing scenes) |
| `scripts/slice-grid.py sheet.png --rows R --cols C --out dir --names a,b,… --key none\|black\|alpha\|green [--trim] --size N` | cut sheets, key backgrounds, export webp |

**API model: only `cx/gpt-6-sol-image`.** Other 9router image models (gpt-image-2.5 and family) fall
short of the codex/agy quality bar for this game — do not switch to them, even on errors.

Pick the tools for a whole sect with `GEN_CHAR_TOOL` / `GEN_SHEET_TOOL` (defaults codex / agy).

Which model:
- **codex** — best chibi look, real transparency (cut-outs), follows references closely. ~1–2 min.
- **agy** — fast, very clean pure-black backgrounds (icons, VFX), good scenes. No alpha.
- **api** — any OpenAI-compatible Images API via curl, configured in `.env.image-api` at the repo root
  (template: `.env.image-api.example`, the real file is gitignored). References (`--ref`) go as `images[]`
  data URLs on `/images/generations` (9router codex models: capability `edit`, see
  `/v1/models/info?id=<model>`), and `background: transparent` is used for cut-outs. If 9router answers
  "Account may not be entitled" or "reset after …", the ChatGPT account behind it is out of quota or
  cooling down — wait, do not hammer it (failed calls extend the cooldown).
  Smoke test: `scripts/gen-image.sh --tool api --out /tmp/api-test.png --prompt "a glossy black pool 8-ball"`.

Run several `gen-image.sh` calls in parallel (background jobs) — each uses its own temp dir.
Keep raw sheets and prompts in the scratchpad; only processed webp files go into the repo.

## Workflow per sect

1. **Cut-outs** (codex, transparent): one per champion. These define each character.
2. **Chibi portraits**, **victory pose** (`--ref` the cut-out) and the **2x2 expression sheet**
   (focus · joy · frustrated · casting, `--ref` the portrait) so face/outfit match everywhere.
   `scripts/gen-sect.sh SECT WORK` runs steps 1–7 for a whole sect and skips files already made.
3. **Sect splash bg + cut-in strip** (agy or codex).
4. **Icon sheet 4x4**: 3 skills × 5 champions + emblem, black bg → `--key black --trim`.
5. **VFX sheet 5x5**: element ids fixed in the template, black bg → `--key black --trim`.
6. Optional **flipbook 4x4** for the signature ultimate (no `--trim`).
7. **Table felt, rail, two cues**.
8. Look at every output (Read the image) before accepting; regenerate cells that break the
   style bible (text, wrong colours, cropped, gridlines, IP look-alikes).

## Output layout (`public/art/`)

```
public/art/
  champions/{id}/portrait.webp  cutout.webp  win.webp  expr-{focus|joy|sad|cast}.webp
  sects/{sect}/emblem.webp  splash.webp  cutin.webp  felt.webp  rail.webp  cue-a.webp  cue-b.webp
  sects/{sect}/vfx/{element}.webp          (25 ids from the template)
  sects/{sect}/flip/{effect}-{00..15}.webp
  skills/{champion}-{1|2|u}.webp
  ui/{name}.webp                            (menu/key art)
```

Champion ids, sect ids and skill numbering match `src/game/content/` data. After adding files,
make sure `vite.config.ts` PWA `globPatterns` still covers webp (it does) and that total size of a
sect stays under ~3 MB (webp q86; portraits 256, icons 128).

## How VFX turns into skill animation

Thuỷ Mặc rule: effects are **coloured ink brushwork with paper-white edges on transparent
backgrounds**, painted over the cloth with normal blending — never additive light. Ultimates: the
cut-in strip is a big brush stroke revealed like painting, the name sits on a paper slip, and a
vermilion seal stamps down; the flipbook is an ink drop blooming into the sect symbol.

Generated pieces are static; motion is code (`src/render/` skill fx):
- cut-in: strip slides in diagonally → cut-out flies in with parallax and overshoot → skill name
  plate + screen shake → everything slides out (~1.2 s, ultimates only);
- on-table: `circle/runes` rotate and scale in under the cue ball, `slash/shock/burst` pop with
  additive blend, `shard/flake/spark` are particle textures, `chain/talisman` mark sealed pockets,
  `vortex` spins over a pulling pocket, flipbooks play at 24 fps.
Pick elements per skill family so every sect's version of a family reads the same but looks local.
