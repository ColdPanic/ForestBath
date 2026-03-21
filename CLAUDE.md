# ForestBath — Claude Context

This repo is a browser game portal shared between two collaborators. The landing page (`index.html` at the repo root) displays a card grid of games. Each game lives in its own subfolder. The live site is at `https://coldpanic.github.io/ForestBath/`.

---

## Repo structure

```
ForestBath/
├── index.html          ← the portal landing page
├── package.json        ← root-level only, contains `npm start` (python3 http server)
├── README.md
├── CLAUDE.md
├── SetsMaze/           ← example: Vite + Phaser game
│   ├── src/
│   ├── dist/           ← built output (committed, required for GitHub Pages)
│   ├── thumb.png       ← screenshot shown on the portal card
│   ├── package.json
│   └── vite.config.js
├── Setsris/            ← same structure
└── SetsTower/          ← same structure (currently commented out of portal)
```

---

## Two types of games

### 1. Single-file games (simplest)
A plain `index.html` with all HTML, CSS, and JS inline. No build step needed.
- Folder path goes directly in the GAMES array: `"MyGame/index.html"`

### 2. Vite/npm games (like the existing ones)
Have a `src/` folder, `package.json`, and must be built before they work in production.
- Always include `vite.config.js` with `base: './'` so asset paths are relative:
  ```js
  import { defineConfig } from 'vite'
  export default defineConfig({ base: './' })
  ```
- Build command: `node node_modules/vite/bin/vite.js build` (not `npm run build` — Node v16 compatibility)
- Built output goes to `dist/` — this folder **must be committed** (GitHub Pages has no build step)
- Portal path uses the dist output: `"MyGame/dist/index.html"`

---

## Adding a game — checklist

1. Create a folder with no spaces in the name (e.g. `MyGame/`)
2. Add game files — at minimum an `index.html` that runs the game
3. If it's a Vite game: add `vite.config.js` with `base: './'`, then build
4. Add a `thumb.png` screenshot if possible
5. Register it in the `GAMES` array in `index.html` (see format below)
6. Test locally with `npm start` → `http://localhost:8080`
7. Commit everything **except** `node_modules/` and `.claude/` (both are in `.gitignore`)
8. Push — GitHub Pages updates within a minute or two

---

## GAMES array format

Located in the `<script>` block of `index.html`:

```js
{
  title: "My Game",
  desc:  "One sentence about what the game is.",
  tag:   "arcade",           // genre label on the card
  emoji: "🎮",               // shown if no thumb
  src:   "MyGame/index.html",
  thumb: "MyGame/thumb.png"  // optional — remove line if no screenshot
},
```

To temporarily hide a game without deleting it, wrap the entry in `//` comment blocks.

---

## Local development

```bash
npm start        # starts python3 -m http.server 8080
```

Open `http://localhost:8080` in the browser. Games must be served over HTTP (not opened as files) because they use ES modules.

---

## Important conventions

- **Never commit `node_modules/`** — it's gitignored and causes oversized pushes
- **Always commit `dist/`** — it's the only way games run on GitHub Pages
- **No spaces in folder names** — breaks URL routing
- **`base: './'` in vite.config.js is required** — without it, asset paths break in subdirectories
- **Git push buffer** — if a push fails with HTTP 400, run: `git config http.postBuffer 524288000`
