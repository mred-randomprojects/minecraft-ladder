# The Minecraft Ladder

A step-by-step Minecraft progression guide, built as a "ladder" you climb rung by rung. Seven parallel skill trees — Main Quest, Gearing Up, Food & Farming, Exploration, Redstone & Building, The Nether, and Endgame & Beyond — each with ordered steps, short "what to actually do" explanations, subtasks, and a quick link to the official [Minecraft Wiki](https://minecraft.wiki) for every item. Tick the rungs and the road turns green behind you. Progress is saved locally in the browser.

## How it's built

A single self-contained `index.html` — all CSS and JS are inline, no build step, no dependencies. Progress is stored in `localStorage` (no account needed, private to each device). The page is theme-aware (light/dark) and installable as a PWA via `manifest.webmanifest`.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which publishes the site to GitHub Pages automatically. No local build.

## Editing

Open `index.html` and edit directly. Every tree, step, explanation, and subtask lives in the `TREES` array inside the `<script>` block — add a step or a whole new tree there and it renders automatically.

## Notes

- Progression numbers (e.g. diamonds around Y = -58, ancient debris around Y = 15) reflect Java/Bedrock 1.20+.
- Wiki links open the official Minecraft Wiki page for each item — the reliable stand-in for in-game images.
