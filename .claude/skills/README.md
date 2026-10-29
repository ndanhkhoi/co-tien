# Agent skills for Cơ Tiên

Skills an AI coding agent (Claude Code and compatible tools) loads when working on this repo.
Each folder holds a `SKILL.md` (when to use it, how) plus optional references and scripts.

| Skill | Use it for |
|---|---|
| `game-art` | **Project-specific.** Generating, slicing, reviewing and installing all game art in the Thuỷ Mặc style (champions, sect art, icons, VFX, UI). Start here for any image work. |
| `pixijs-rendering` | The PixiJS 8 render layer (`src/render`): table, ball meshes, cue, effects. |
| `physics-tuning` | The billiards simulation (`src/core/physics.ts`): friction, cushions, stepping, terrain forces. |
| `shader-programming` | The ball sphere shader (`src/render/ball-mesh.ts`). |
| `game-feel` | Shot feedback: power charge, shake, hit pauses, sound and haptic timing. |
| `game-ui-ux` | Screens, HUD, menus, landscape guards, coach hints (`src/ui`). |
| `input-systems` | Touch joysticks, drag-to-aim, keyboard and mouse controls. |
| `game-ai` | The shot-searching opponent (`src/ai`). |
| `audio-design` | The synthesized WebAudio sound (`src/audio`). |
| `save-systems` | The player profile, migrations and save codes (`src/game/profile.ts`). |
| `performance-optimization` | Keeping 60 fps on phones: physics stepping, draw calls, asset sizes, precache. |
| `fiction-workshop` | Writing and editing Cơ Tiên Truyện (`src/game/content/story.json`): line editing, character voice, continuity. `docs/world-bible.md` is the story bible. |

## Third-party notice

All skills except `game-art` and `fiction-workshop` come from
[gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills),
licensed under the Apache License 2.0 (copy in `THIRD-PARTY-LICENSE-Apache-2.0.txt`). They are
included unmodified. `game-art` is written for this project and is covered by the repo's MIT licence.

`fiction-workshop` comes from [rhavekost/author-toolkit](https://github.com/rhavekost/author-toolkit),
licensed under the MIT License (copy in `fiction-workshop/LICENSE`). It is included unmodified.
