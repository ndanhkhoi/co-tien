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
- `src/ui` DOM screens over the canvas; `src/styles/{base,kit,screens,match}.css` define the Thuỷ Mặc UI
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
5. **Mobile landscape first.** Test at ~844×390; touch targets ≥ 44 px; respect reduced motion.
6. **Data first.** Champions/sects are data; keep `docs/world-bible.md` in sync with `roster.json`/`lore.json`.
7. **Saves are sacred.** Profile changes go through `sanitize` in `src/game/profile.ts`; never rename the
   storage key `thancong.profile.v1`.
8. **Painted assets only.** Every graphic must be a painted asset; no hand-drawn SVG, emoji or icon libraries.
   **Art via the skill.** Use `.claude/skills/game-art` (prompts, references, scripts). The image API key lives
   in `.env.image-api` (gitignored) — never commit it. Use `--tool api` with only model `cx/gpt-6-sol-image`;
   disable tool fallback.
   **Vietnamese UI.** Write all player-facing UI copy in Vietnamese.
9. Conventional commits, one concern per commit, no AI references in commit messages. Run `npm test` and
   `npm run build` first.
