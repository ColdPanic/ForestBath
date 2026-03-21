import Phaser from 'phaser'
import { CardData, generateDeck, shuffle } from '../CardData.js'
import { isValidSet } from '../SetValidator.js'
import { ensureCardTexture, cardTextureKey, CARD_W, CARD_H } from '../CardSprite.js'

const W      = 570
const H      = 900
const COLS   = 9
const ROWS   = 9
const GAP    = 2

// Grid centred horizontally, starting below the UI strip
const GRID_W = COLS * CARD_W + (COLS - 1) * GAP   // 376 px
const GRID_H = ROWS * CARD_H + (ROWS - 1) * GAP   // 520 px
const GRID_X = Math.round((W - GRID_W) / 2)        // 7 px
const GRID_Y = 90

// S-curve solution path: 6 groups of 3 cells forming valid Sets
// Groups are consecutive and orthogonally adjacent.
//   Group 1  H row 0:  (0,0)★ (0,1) (0,2)      ← START
//   Group 2  V col 2:  (1,2)  (2,2) (3,2)
//   Group 3  H row 3:  (3,3)  (3,4) (3,5)
//   Group 4  V col 5:  (4,5)  (5,5) (6,5)
//   Group 5  H row 6:  (5,6)  (5,7) (5,8)
//   Group 6  V col 8:  (6,8)  (7,8) (8,8)★      ← FINISH
const PATH_GROUPS = [
  [[0,0],[0,1],[0,2]],
  [[1,2],[2,2],[3,2]],
  [[3,3],[3,4],[3,5]],
  [[4,5],[5,5],[6,5]],
  [[5,6],[5,7],[5,8]],
  [[6,8],[7,8],[8,8]],
]

// Generate a random triple of CardData that forms a guaranteed valid Set.
function randomValidTriple() {
  const attrs = ['color', 'shape', 'fill']
  const a = new CardData(
    Math.floor(Math.random() * 3),
    Math.floor(Math.random() * 3),
    Math.floor(Math.random() * 3),
  )
  const b = new CardData(
    Math.floor(Math.random() * 3),
    Math.floor(Math.random() * 3),
    Math.floor(Math.random() * 3),
  )
  const c = new CardData(
    ...attrs.map(attr => ((3 - a[attr] - b[attr]) % 3 + 3) % 3)
  )
  return [a, b, c]
}

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }

  create() {
    // ── Build card layout: path groups first, then fill remaining cells ────────
    const cardAt = Array.from({ length: ROWS }, () => new Array(COLS).fill(null))

    for (const group of PATH_GROUPS) {
      const triple = randomValidTriple()
      group.forEach(([row, col], i) => { cardAt[row][col] = triple[i] })
    }

    // Fill non-path cells from 3× shuffled deck (81 cards, 63 non-path slots)
    const filler = shuffle([...generateDeck(), ...generateDeck(), ...generateDeck()])
    let fi = 0
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!cardAt[row][col]) cardAt[row][col] = filler[fi++]
      }
    }

    // Pre-generate all 27 card textures
    for (const card of generateDeck()) ensureCardTexture(this, card)

    this._score        = 0
    this._selected     = []   // [{row, col}]
    this._grid         = []   // [row][col] = {card, sprite} or null
    this._alive        = true
    this._lastCleared  = null  // [{row,col}] of last cleared group, null = not yet started
    this._dragging      = false
    this._dragVisited   = new Set()
    this._lastClearTime = null  // for consecutive-clear drama level

    // ── Background slot grid (depth 1) ────────────────────────────────────────
    const slotGfx = this.add.graphics().setDepth(1)
    slotGfx.fillStyle(0x0d0d1a, 1)
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        slotGfx.fillRoundedRect(
          GRID_X + col * (CARD_W + GAP),
          GRID_Y + row * (CARD_H + GAP),
          CARD_W, CARD_H, 4
        )
      }
    }

    // ── Start / Finish marker borders (static, depth 5) ───────────────────────
    const markerGfx = this.add.graphics().setDepth(5)

    // Start (0,0): green border
    markerGfx.lineStyle(3, 0x44ff88, 1)
    markerGfx.strokeRoundedRect(
      GRID_X - 1,
      GRID_Y - 1,
      CARD_W + 2, CARD_H + 2, 5
    )

    // Finish (8,8): gold border
    markerGfx.lineStyle(3, 0xffcc00, 1)
    markerGfx.strokeRoundedRect(
      GRID_X + 8 * (CARD_W + GAP) - 1,
      GRID_Y + 8 * (CARD_H + GAP) - 1,
      CARD_W + 2, CARD_H + 2, 5
    )

    // ── S / F text badges (depth 6) ───────────────────────────────────────────
    this.add.text(
      GRID_X + 2,
      GRID_Y + 2,
      'S', { fontSize: '13px', color: '#44ff88', fontStyle: 'bold' }
    ).setOrigin(0, 0).setDepth(6)

    this.add.text(
      GRID_X + 8 * (CARD_W + GAP) + CARD_W - 2,
      GRID_Y + 8 * (CARD_H + GAP) + CARD_H - 2,
      'F', { fontSize: '13px', color: '#ffcc00', fontStyle: 'bold' }
    ).setOrigin(1, 1).setDepth(6)

    // ── Active-group frontier highlight (depth 4) ─────────────────────────────
    this._frontierGfx = this.add.graphics().setDepth(4)

    // ── Selection highlight (redrawn on every selection change, depth 7) ──────
    this._selGfx = this.add.graphics().setDepth(7)

    // ── Card sprites (depth 3) ────────────────────────────────────────────────
    for (let row = 0; row < ROWS; row++) {
      this._grid[row] = []
      for (let col = 0; col < COLS; col++) {
        const card = cardAt[row][col]
        const x    = GRID_X + col * (CARD_W + GAP) + CARD_W / 2
        const y    = GRID_Y + row * (CARD_H + GAP) + CARD_H / 2

        const sprite = this.add.image(x, y, cardTextureKey(card))
          .setDisplaySize(CARD_W, CARD_H)
          .setInteractive()
          .setDepth(3)

        sprite.on('pointerdown', () => {
          if (!this._alive || !this._grid[row][col] || this._selected.length >= 3) return
          this._dragging   = true
          this._dragVisited = new Set([`${row},${col}`])
          this._onCardClick(row, col)
        })

        this._grid[row][col] = { card, sprite }
      }
    }

    this.input.on('pointermove', ptr => this._onPointerMove(ptr))
    this.input.on('pointerup',   ()  => { this._dragging = false })

    this._drawFrontier()
    this._refreshInteractivity()

    // ── UI (depth 10) ─────────────────────────────────────────────────────────
    this._scoreTxt = this.add.text(W / 2, 18, 'Sets: 0', {
      fontSize: '28px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10)

    this._statusTxt = this.add.text(W / 2, 56, 'Find a Set — start near the cyan tiles', {
      fontSize: '18px', color: '#8888aa',
      backgroundColor: '#00000066', padding: { x: 10, y: 4 },
    }).setOrigin(0.5).setDepth(10)
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  _onCardClick(row, col) {
    if (!this._alive) return
    const cell = this._grid[row][col]
    if (!cell) return  // empty slot

    // Deselect if already selected
    const idx = this._selected.findIndex(s => s.row === row && s.col === col)
    if (idx !== -1) {
      this._selected.splice(idx, 1)
      this._drawSelection()
      this._refreshInteractivity()
      return
    }

    if (this._selected.length >= 3) return  // full — wait for validation

    this._selected.push({ row, col })
    this._drawSelection()
    if (this._selected.length < 3) this._refreshInteractivity()

    if (this._selected.length === 3) this._validate()
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  _validate() {
    const cells      = this._selected.map(s => this._grid[s.row][s.col])
    const [a, b, c]  = cells.map(cell => cell.card)
    const wasDragging = this._dragging

    // Shared clear logic — updates game state immediately, then plays dissolve.
    const doClear = () => {
      const cleared = [...this._selected]

      // Collect sprite + position + card colour before nulling the grid.
      const FRAG_COLORS = [0xff5555, 0x55ee88, 0xbb55ff]
      const dissolveTargets = cleared.map(s => {
        const cell = this._grid[s.row][s.col]
        return {
          sprite:    cell.sprite,
          x:         GRID_X + s.col * (CARD_W + GAP) + CARD_W / 2,
          y:         GRID_Y + s.row * (CARD_H + GAP) + CARD_H / 2,
          fragColor: FRAG_COLORS[cell.card.color] ?? 0xffffff,
        }
      })

      // Drama level: how fast was this clear relative to the previous one?
      const now     = Date.now()
      const elapsed = this._lastClearTime != null ? now - this._lastClearTime : Infinity
      this._lastClearTime = now
      const level = elapsed > 4000 ? 0
                  : elapsed > 2000 ? 1
                  : elapsed > 1000 ? 2
                  : elapsed >  500 ? 3 : 4

      // Update all game state immediately so drag / next picks work at once.
      for (const s of cleared) this._grid[s.row][s.col] = null
      this._selected    = []
      this._dragVisited = new Set()
      this._drawSelection()
      this._lastCleared = cleared
      this._drawFrontier()
      this._refreshInteractivity()
      this._statusTxt.setText('Set! Follow the cyan tiles').setColor('#8888aa')
      if (cleared.some(s => s.row === 8 && s.col === 8)) this._win()

      // Visual dissolve (purely cosmetic, runs in parallel with gameplay).
      for (const t of dissolveTargets)
        this._playDissolve(t.sprite, t.x, t.y, level, t.fragColor)
    }

    if (isValidSet(a, b, c)) {
      this._score++
      this._scoreTxt.setText(`Sets: ${this._score}`)

      if (wasDragging) {
        // Drag: instant clear so the gesture flows without pause.
        doClear()
      } else {
        // Tap: brief green flash then clear.
        this._statusTxt.setText('Set! ✓').setColor('#44ff88')
        cells.forEach(cell => cell.sprite.setTint(0x44ff88))
        this.time.delayedCall(180, doClear)
      }
    } else {
      // Flash red, clear selection — no game over.
      for (const s of this._selected) {
        this._grid[s.row][s.col]?.sprite.setTint(0xff4444)
      }
      this._statusTxt.setText('Not a Set').setColor('#ff4444')
      this.time.delayedCall(wasDragging ? 120 : 300, () => {
        for (const s of this._selected) {
          this._grid[s.row][s.col]?.sprite.clearTint()
        }
        this._selected    = []
        this._dragVisited = new Set()
        this._drawSelection()
        this._refreshInteractivity()
        this._statusTxt.setText('Find a Set — follow the cyan tiles').setColor('#8888aa')
      })
    }
  }

  // ── Selection drawing ──────────────────────────────────────────────────────

  _drawSelection() {
    this._selGfx.clear()
    for (const s of this._selected) {
      const x = GRID_X + s.col * (CARD_W + GAP)
      const y = GRID_Y + s.row * (CARD_H + GAP)
      this._selGfx.lineStyle(2, 0xffcc00, 1)
      this._selGfx.strokeRoundedRect(x - 1, y - 1, CARD_W + 2, CARD_H + 2, 5)
    }
  }

  // ── Drag input ─────────────────────────────────────────────────────────────

  // Convert scene coordinates to a grid cell, or null if outside/in a gap.
  _cellAtPoint(x, y) {
    const col = Math.floor((x - GRID_X) / (CARD_W + GAP))
    const row = Math.floor((y - GRID_Y) / (CARD_H + GAP))
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null
    const cx = GRID_X + col * (CARD_W + GAP)
    const cy = GRID_Y + row * (CARD_H + GAP)
    if (x < cx || x >= cx + CARD_W || y < cy || y >= cy + CARD_H) return null
    return { row, col }
  }

  _onPointerMove(ptr) {
    if (!this._dragging || !this._alive || this._selected.length >= 3) return
    const hit = this._cellAtPoint(ptr.x, ptr.y)
    if (!hit) return
    const key = `${hit.row},${hit.col}`
    if (this._dragVisited.has(key)) return
    const cell = this._grid[hit.row]?.[hit.col]
    if (!cell || !cell.sprite.input?.enabled) return
    this._dragVisited.add(key)
    // Mirror the selection logic from _onCardClick (no deselect during drag).
    if (this._selected.findIndex(s => s.row === hit.row && s.col === hit.col) !== -1) return
    this._selected.push({ row: hit.row, col: hit.col })
    this._drawSelection()
    if (this._selected.length < 3) this._refreshInteractivity()
    if (this._selected.length === 3) this._validate()
  }

  // ── Frontier highlight ─────────────────────────────────────────────────────

  // Returns orthogonal neighbors of `cells` that are inside the grid and not in `cells`.
  _getNeighbors(cells) {
    const inGroup = new Set(cells.map(({ row, col }) => `${row},${col}`))
    const seen    = new Set()
    const result  = []
    for (const { row, col } of cells) {
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = row + dr, nc = col + dc
        const key = `${nr},${nc}`
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !inGroup.has(key) && !seen.has(key)) {
          seen.add(key)
          result.push({ row: nr, col: nc })
        }
      }
    }
    return result
  }

  // Cells the player should look among: start cell + its neighbors initially,
  // then the orthogonal neighbors of the last cleared group.
  _getFrontierCells() {
    const seed = this._lastCleared ?? [{ row: 0, col: 0 }]
    return this._lastCleared
      ? this._getNeighbors(seed)
      : [{ row: 0, col: 0 }, ...this._getNeighbors(seed)]
  }

  // Draw cyan borders on the frontier (graphics only, no interactivity changes).
  _drawFrontier() {
    this._frontierGfx.clear()
    this._frontierGfx.lineStyle(3, 0x00ddff, 1)
    for (const { row, col } of this._getFrontierCells()) {
      if (!this._grid[row]?.[col]) continue
      const x = GRID_X + col * (CARD_W + GAP)
      const y = GRID_Y + row * (CARD_H + GAP)
      this._frontierGfx.strokeRoundedRect(x - 1, y - 1, CARD_W + 2, CARD_H + 2, 5)
    }
  }

  // Decide which cells are clickable:
  //   0 selected → frontier cells only (guides the first pick).
  //   1 selected → all non-cleared cells (free choice for second pick).
  //   2 selected → only the cell(s) that complete a valid Set + the two
  //                already-selected cells so the player can deselect.
  _refreshInteractivity() {
    // Disable everything first.
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        this._grid[r]?.[c]?.sprite.disableInteractive()

    if (this._selected.length === 0) {
      // Nothing selected: only the frontier cells are valid starting picks.
      for (const { row, col } of this._getFrontierCells())
        this._grid[row]?.[col]?.sprite.setInteractive()
    } else {
      // 1 or 2 selected: full board is open so the player can attempt any combination.
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          this._grid[r]?.[c]?.sprite.setInteractive()
    }
  }

  // ── Dissolve animation ─────────────────────────────────────────────────────
  // level 0 = slow/first clear … level 4 = rapid consecutive streak.

  _playDissolve(sprite, x, y, level, fragColor) {
    const dir = Math.random() < 0.5 ? 1 : -1

    // ── White card flash (all levels, stronger at higher levels) ──────────────
    const flashAlpha = [0.55, 0.80, 1.0, 1.0, 1.0][level]
    const flash = this.add.rectangle(x, y, CARD_W, CARD_H, 0xffffff, flashAlpha).setDepth(8)
    this.tweens.add({ targets: flash, alpha: 0, duration: [90, 110, 130, 150, 170][level],
                      onComplete: () => flash.destroy() })

    // ── Expanding shockwave ring (level 1+) ───────────────────────────────────
    if (level >= 1) {
      const ring = this.add.graphics().setDepth(8)
      ring.lineStyle(2 + level, fragColor, 0.9)
      ring.strokeRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H)
      ring.setPosition(x, y)
      const endScale = 1.6 + level * 0.65
      this.tweens.add({
        targets: ring, scaleX: endScale, scaleY: endScale, alpha: 0,
        duration: 300 + level * 55, ease: 'Power2',
        onComplete: () => ring.destroy(),
      })
    }

    // ── Burst fragments (all levels, way more at higher levels) ───────────────
    const fragCounts = [5, 10, 16, 24, 34]
    for (let i = 0; i < fragCounts[level]; i++) {
      const angle = (i / fragCounts[level]) * Math.PI * 2 + Math.random() * 0.4
      const dist  = 50 + level * 35 + Math.random() * 30
      const size  = 3 + Math.floor(Math.random() * (3 + level * 2.5))
      const frag  = this.add.rectangle(x, y, size, size, fragColor).setDepth(8)
      this.tweens.add({
        targets: frag,
        x:        x + Math.cos(angle) * dist,
        y:        y + Math.sin(angle) * dist,
        alpha:    0,
        scaleX:   0, scaleY: 0,
        duration: 270 + level * 55 + Math.random() * 90,
        ease:     'Power2',
        onComplete: () => frag.destroy(),
      })
    }

    // ── Screen flash (level 2+, increasingly intense) ─────────────────────────
    if (level >= 2) {
      const sfAlpha = [0, 0, 0.18, 0.32, 0.50][level]
      const sf = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, sfAlpha).setDepth(19)
      this.tweens.add({ targets: sf, alpha: 0, duration: 230 + level * 65,
                        onComplete: () => sf.destroy() })
    }

    // ── Main sprite: shrink to nothing + fade + spin ──────────────────────────
    const spinDeg = [0, 0, 22, 58, 95][level]
    this.tweens.add({
      targets:    sprite,
      alpha:      0,
      scaleX:     0,
      scaleY:     0,
      angle:      sprite.angle + dir * spinDeg,
      duration:   [190, 230, 270, 320, 370][level],
      ease:       level <= 1 ? 'Power2' : 'Power3',
      onComplete: () => sprite.destroy(),
    })
  }

  // ── Win ────────────────────────────────────────────────────────────────────

  _win() {
    this._alive = false
    this._statusTxt.setText('You reached the Finish!').setColor('#44ff88')

    this.time.delayedCall(400, () => {
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75).setDepth(20)

      this.add.text(W / 2, H / 2 - 60, 'YOU WIN!', {
        fontSize: '52px', color: '#44ff88', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 6,
      }).setOrigin(0.5).setDepth(25)

      this.add.text(W / 2, H / 2 + 10, `Sets cleared: ${this._score}`, {
        fontSize: '26px', color: '#ffffff',
      }).setOrigin(0.5).setDepth(25)

      this.add.text(W / 2, H / 2 + 62, 'tap or press any key', {
        fontSize: '18px', color: '#888888',
      }).setOrigin(0.5).setDepth(25)

      this.time.delayedCall(600, () => {
        this.input.once('pointerdown', () => this.scene.restart())
        this.input.keyboard.once('keydown', () => this.scene.restart())
      })
    })
  }

  // ── Game over ──────────────────────────────────────────────────────────────

  _gameOver() {
    this._alive = false

    // Flash selected cards red
    for (const s of this._selected) {
      this._grid[s.row][s.col]?.sprite.setTint(0xff4444)
    }
    this._statusTxt.setText('Not a Set!').setColor('#ff4444')
    this._selGfx.clear()

    this.time.delayedCall(700, () => {
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75).setDepth(20)

      this.add.text(W / 2, H / 2 - 50, 'GAME OVER', {
        fontSize: '48px', color: '#ff4444', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 6,
      }).setOrigin(0.5).setDepth(25)

      this.add.text(W / 2, H / 2 + 16, `Sets cleared: ${this._score}`, {
        fontSize: '26px', color: '#ffffff',
      }).setOrigin(0.5).setDepth(25)

      this.add.text(W / 2, H / 2 + 68, 'tap or press any key', {
        fontSize: '18px', color: '#888888',
      }).setOrigin(0.5).setDepth(25)

      this.time.delayedCall(600, () => {
        this.input.once('pointerdown', () => this.scene.restart())
        this.input.keyboard.once('keydown', () => this.scene.restart())
      })
    })
  }
}
