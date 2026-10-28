# AGENTS.md — working on Cơ Tiên

Instructions for AI coding agents (and humans) contributing to this repo. Read `CONTRIBUTING.md` and the
docs it links before large changes.

## What this is

Cơ Tiên ("bida tu tiên"): a mobile-first landscape billiards game with real physics and WPA/UMB rules, set
in an original xianxia world of 13 sects and 65 champions with skills. TypeScript + Vite + PixiJS 8, shipped
as a PWA on GitHub Pages (`https://ndanhkhoi.github.io/co-tien/`). No backend.

## Commands

```bash
npm run dev          # dev server (append ?gate to preview the install screen)
npm test             # vitest: physics, rules, AI, challenges, ball/felt contrast
npm run build        # tsc + vite build (must pass before committing)
npm run gen:challenges
```

## Map

- `src/core` physics, table geometry (WPA sizes), racks, rules — pure, no DOM
- `src/game` match state machine, terrain (Thiên Tượng), profile; `content/` holds the data
  (`roster.json` sects/champions/skills, `lore.json` stories, `story.json` Cơ Tiên Truyện, `career.ts`, `challenges.json`)
- `src/ai` shot-search opponent in a Web Worker
- `src/render` PixiJS table, ball shader, skill FX
- `src/ui` DOM screens over the canvas; `src/styles/{base,kit,screens,match,skin}.css` define the Thuỷ Mặc UI
- `public/art` processed art (webp); master art lives outside the repo
- `.claude/skills` agent skills; `game-art` is this project's art pipeline

## Rules

1. **Real physics.** Skills and terrain must be forces, friction, obstacles or pocket size in the simulation.
   Tilt/wind stays below rolling resistance (μr·g ≈ 0.108 m/s²) so resting balls never creep.
2. **Original IP only.** Never use names, art or abilities from any other game or franchise. Reject
   generated art that resembles a known character.
3. **Thuỷ Mặc look.** Paper, black ink, one vermilion accent, serif display type (Noto Serif), body in Be
   Vietnam Pro; no glow, no gold 3D text. Champions keep their colourful anime design on paper backgrounds.
4. **Readable balls.** Any felt colour must pass `tests/sect-contrast.test.ts`.
5. **Mobile landscape first.** DOM design is 844×390; `main.ts` scales it uniformly (0.75–2.2), except the install gate. Test at ~844×390; touch targets ≥ 44 px; respect reduced motion.
6. **Data first.** Champions/sects are data; keep all 195 skill names in sync. `kind` is one of six appearance types, `cls` selects one of seven passives; slots 0/1 are basics, slot 2 is ultimate. Eight placed families are `slick`, `sand`, `bumper`, `railcraft`, `wind`, `well`, `spinwash`, `vortex`; keep `docs/world-bible.md` in sync with `roster.json`/`lore.json`.
7. **Saves are sacred.** Profile changes go through `sanitize` in `src/game/profile.ts`; never rename the
   storage key `thancong.profile.v1`.
8. **Art and simulation rendering.** All illustrations, icons and UI decoration must be original painted assets generated through the art pipeline; no internet assets, franchise material, hand-drawn SVG, emoji or icon libraries. Code/shaders may render simulated objects such as balls and the table: geometry, numbers/stripes, colours, lighting and rotation driven by physics. This exception does not cover illustrations, icons or UI decoration.
   **Art via the skill.** Use `.claude/skills/game-art` (prompts, references, scripts). The image API key lives
   in `.env.image-api` (gitignored) — never commit it. Generate through 9router with model `cx/gpt-6-sol-image`.
   **Vietnamese UI.** Write all player-facing UI copy in Vietnamese.
9. Conventional commits, one concern per commit, no AI references in commit messages. Run `npm test` and
   `npm run build` first.

## Loading and modes

Use the existing three-tier loader in `src/platform/preload.ts`: blocking core per build, idle background (skip save-data), then per-match fetch/decode. PWA updates apply from menus or on leaving the stage; preserve that match boundary. `skin.css` loads last; preserve reduced-motion handling. Tiên Đạo enables skills/passives/terrain; Cổ Điển and challenges disable them. Menu names: Luận Cơ, Song Đấu, Luyện Cơ, Tàng Các, Hành trình, Cơ Tiên Truyện, Cơ Tiên Lục.

## Current controls

Aim by dragging/tapping the table or the two rotation buttons. Spin uses a draggable/tappable point on the large cue ball and presets. Tap/drag the power bar, then tap ĐÁNH; holding ĐÁNH charges an oscillating meter, sliding away cancels. Ball-in-hand uses drag/tap or four direction buttons, Ngắm thử / Dời bi, then ĐẶT BI. Preserve the three champion-specific painted skill icons and detail-before-use flow. Safe-area and touch-target tokens compensate for DOM scale; verify rendered sizes.
