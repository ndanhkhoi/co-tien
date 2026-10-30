# AGENTS.md: working on Cơ Tiên

Rules for AI coding agents in this repo. Cơ Tiên is a mobile-first landscape billiards PWA (TypeScript, Vite,
PixiJS 8) with an original xianxia world; no backend. Find the doc for the area you touch in
[docs/README.md](docs/README.md); contribution rules and the full code principles are in
[CONTRIBUTING.md](CONTRIBUTING.md).

## Commands

```bash
npm run dev               # dev server; ?gate shows the install screen, ?loading the art loader
npm test                  # vitest
npx vitest run tests/X.test.ts
npm run build             # tsc + vite build
npm run lint              # size, complexity, layering, dead code, duplication (eslint, stylelint, check-css, knip, jscpd)
npm run gen:challenges    # regenerate challenges.json after physics/rule changes; never hand-edit it
```

Done means `npm test`, `npm run lint` and `npm run build` all pass, and the owning doc is updated in the same change.

## Never

- Never rename the save key `thancong.profile.v1` or bypass `sanitize` in `src/game/profile.ts`.
  Practice saves (`cotien.practice.v1`) go through `sanitizeSaved`.
- Never script a trajectory while balls roll or rewrite a shot's result after it resolves. Discrete,
  deterministic state changes while every ball rests, simulated objects and information effects are allowed.
  Tilt/wind stays below rolling resistance (μr·g ≈ 0.108 m/s²), except the announced tier-5 Địa Chấn
  ultimate (1.6× μr·g for 1.2 s). Wind keeps one direction per turn.
- Never use names, art or abilities from another game or franchise, and never mention any game as inspiration
  in the repo, docs or commits.
- Never add hand-drawn SVG, emoji, icon libraries or internet images. Illustrations, icons and UI decoration
  come from the art pipeline (`.claude/skills/game-art`, model `cx/gpt-6-sol-image` via 9router). Code and
  shaders may only render simulated objects (balls, table).
- Never commit `.env.image-api` or any API key.
- Never import upward: `core` ← `game` ← `ai`/`render` ← `ui`; `platform` and `audio` are leaves.
- Never read layout (`getBoundingClientRect`, `offsetWidth`) in per-frame code; use `uiOrigin()`/`uiScale()`.
- Never use viewport media queries, `vw` or `vh` inside the 844×475 frame.
- Never key art caches by build, and never apply a PWA update during a match.
- Never read the roster art briefs (`look`, `pose`, `expr`, skill `icon`, sect `motifs`/`emblem`/`element`)
  from game code; `vite.config.ts` strips them from the build.
- Never change game defaults for screenshots.

## Always

- Run `node .claude/skills/anti-slop/scripts/scan.mjs` after writing player-facing copy, story or docs; it must
  report no errors (rules in `.claude/skills/anti-slop`).
- Write all player-facing copy in Vietnamese. Keep the Thuỷ Mặc look: paper, black ink, one vermilion accent,
  Noto Serif display, Be Vietnam Pro body, no glow or gold 3D text.
- New felt colours must pass `tests/sect-contrast.test.ts`.
- Nine-slice frames (`border-image`) keep a 1px transparent border (WebKit paints none on zero-width borders).
- Touch targets ≥ 44 px after scaling; respect `prefers-reduced-motion`.
- Check UI changes at 932×430 touch, 1536×864 mouse (Full HD laptop at 125%) and 2560×1440 mouse;
  WebKit-specific bugs need a real iPhone.
- Keep `docs/world/world-bible.md` in sync with `roster.json`/`lore.json`, and all 195 skill names unique.
  Slots 0/1 are basics, slot 2 the ultimate; `kind` is appearance, `cls` the passive.
- Add sects, champions, skill kinds, omens and modes through data or a registry entry, not new
  `if (mode === …)` / `kind === …` branches.
- Silence or loosen a lint rule: no `eslint-disable`, no config edits to make code pass. `npm run lint` enforces
  files ≤ 500 and functions ≤ 80 code lines, cognitive complexity ≤ 15, depth ≤ 4, ≤ 4 parameters, the layer
  direction, no unused exports/classes/keyframes and no copy-paste; fix the code instead.
- Treat [docs/gameplay/controls.md](docs/gameplay/controls.md) and the mode table in
  [docs/architecture/match-and-modes.md](docs/architecture/match-and-modes.md) as the player contract: preserve
  them, or update them in the same change when the request changes them.
- Use the art loader in `src/platform/preload.ts` for art; add new art under paths the manifest picks up.
- When a change alters a screen pictured in README or docs, retake exactly those screenshots (932×430 @2x,
  player champion Ngân Cầm `ngancam` in the screenshot browser's profile only) and update their captions.
- Commit with Conventional Commits, one concern per commit, no AI references in messages.

## Skills

`.claude/skills/README.md` lists the agent skills; `game-art` is this project's art pipeline and the place to
start for any image work.
