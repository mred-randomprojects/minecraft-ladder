# The Minecraft Ladder

A step-by-step Minecraft progression guide, built as a "ladder" you climb rung by rung. Seven parallel skill trees — Main Quest, Gearing Up, Food & Farming, Exploration, Redstone & Building, The Nether, and Endgame & Beyond — each with ordered steps, short "what to actually do" explanations, subtasks, and a quick link to the official [Minecraft Wiki](https://minecraft.wiki) for every item. Tick the rungs and the road turns green behind you. Progress is saved locally in the browser.

## How it's built

A single self-contained `index.html` — all CSS and JS are inline, no build step, no dependencies. Progress is stored in `localStorage` (no account needed, private to each device). The page is theme-aware (light/dark) and installable as a PWA via `manifest.webmanifest`. The PNG icons (`apple-touch-icon.png` at 180 px for iOS, `icon-192.png`, `icon-512.png`) are rasterized from `icon.svg`; when it changes, regenerate them with `sips -s format png -z 180 180 icon.svg --out apple-touch-icon.png` (and the same with 192 and 512).

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which runs `node scripts/check.mjs`, stamps `version.json` with the commit, and publishes the site to GitHub Pages. No local build. The check (no dependencies) makes sure the inline scripts parse and that `TREES` is well formed: unique tree ids, every Detour pointing at a tree that exists, every step with its icon, title, description and wiki link, and no misspelled fields. A failed check leaves the previous deploy live.

## Editing

Open `index.html` and edit directly. Every tree, step, explanation, and subtask lives in the `TREES` array inside the `<script>` block — add a step or a whole new tree there and it renders automatically. Run `node scripts/check.mjs` before pushing.

## Notes

- Progression numbers (e.g. diamonds around Y = -58, ancient debris around Y = 15) reflect Java/Bedrock 1.20+.
- Wiki links open the official Minecraft Wiki page for each item — the reliable stand-in for in-game images.
