# ForestBath 🌿

A simple portal for sharing browser game experiments and prototypes.
Live at: **https://coldpanic.github.io/ForestBath/**

---

## Adding a game

### What kinds of games work here?

Any game that runs entirely in the browser as a static HTML page — no server needed. This includes:

- Vanilla HTML/CSS/JavaScript games (simplest option)
- Games built with Phaser, p5.js, Three.js, or any other JS game library
- Games built with Vite (like the existing ones in this repo)

If you're vibe-coding with an AI, asking it to build "a browser game using plain HTML, CSS, and JavaScript in a single file" is the easiest path — no build step needed.

---

### How to add a game

**1. Create a folder for your game**

Give it a short name with no spaces, e.g. `MyGame/`.

**2. Put your game files inside it**

At minimum you need an `index.html` that runs the game when opened in a browser.

- **Single-file game** (easiest): one `index.html` with all the HTML, CSS, and JS inside it. Drop it in the folder and you're done.
- **Multi-file game**: `index.html` plus any JS, CSS, image, or asset files your game needs. Keep them all inside the folder.
- **Vite/npm game**: run `npm run build` inside the folder first. The built output goes into `dist/` — use `MyGame/dist/index.html` as the path in step 3.

**3. Add a thumbnail (optional but nice)**

Take a screenshot of your game and save it as `MyGame/thumb.png`.

**4. Register it in `index.html`**

Open `index.html` at the root of the repo and find the `GAMES` array near the top of the `<script>` block. Add an entry:

```js
{
  title: "My Game",
  desc:  "One sentence about what the game is.",
  tag:   "arcade",          // genre label shown on the card
  emoji: "🎮",              // shown if there's no thumbnail
  src:   "MyGame/index.html",
  thumb: "MyGame/thumb.png" // optional, remove this line if you have no screenshot
},
```

**5. Commit and push**

```bash
git add MyGame/ index.html
git commit -m "Add My Game"
git push
```

GitHub Pages updates automatically within a minute or two.

---

### Tips

- Test locally first by running `npm start` in the repo root, then opening `http://localhost:8080` in your browser.
- Keep `node_modules/` out of your game folder if possible — it bloats the repo. For Vite games, the `dist/` folder is all that's needed to run the game publicly.
- Game folders can be named anything, just avoid spaces (use `MyGame` not `My Game`).
