import Phaser from 'phaser'
import { generateDeck, shuffle } from '../CardData.js'
import { findValidTriple, findInvalidTriple } from '../SetValidator.js'
import { ensureCardTexture, cardTextureKey, CARD_W, CARD_H } from '../CardSprite.js'

const W            = 390
const H            = 844
const CARD_GAP     = 130
const BASE_SPEED   = 100   // px/sec starting fall speed
const SPEED_INC    = 20    // px/sec added per score point
const MAX_SPEED    = 450   // px/sec cap
const GRAVITY      = 900   // px/sec²
const CHUNK_COLS   = 3
const CHUNK_ROWS   = 4
const ROW_H        = 70    // height of each rubble row
const RUBBLE_COLS  = 6     // tiles per rubble row

// Matches CardSprite.js COLORS array order
const CARD_COLORS    = [0xe74c3c, 0x27ae60, 0x8e44ad]
const CREAM          = 0xfaf8f0
const RUBBLE_PALETTE = [0xc0392b, 0x1e8449, 0x7d3c98, 0x935116, 0x1a5276, 0x2c3e50]

const randomFrom = arr => arr[Math.floor(Math.random() * arr.length)]

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }

  create() {
    // Pre-generate all 81 card textures
    for (const card of generateDeck()) ensureCardTexture(this, card)

    this._deck         = shuffle(generateDeck())
    this._score        = 0
    this._rubbleRows   = []   // array of rows (index 0 = bottom row); each = array of hex colors
    this._failedColors = null // card colors saved at shatter time, used when chunks land
    this._cardY        = 0
    this._triple       = null
    this._isValid      = false
    this._busy         = false
    this._alive        = true
    this._chunks       = []

    // ── Rubble graphics (depth 5) ─────────────────────────────────────────────
    this._rubbleGfx = this.add.graphics().setDepth(5)

    // ── Hint labels ───────────────────────────────────────────────────────────
    this.add.text(W / 4, H - 40, '← Not a Set', {
      fontSize: '26px', color: '#ff6b6b', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
      backgroundColor: '#00000099', padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setDepth(9)

    this.add.text(W * 3 / 4, H - 40, 'Set →', {
      fontSize: '26px', color: '#44ff88', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
      backgroundColor: '#00000099', padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setDepth(9)

    // ── Card sprites (depth 8 — above rubble) ─────────────────────────────────
    this._sprites = [-CARD_GAP, 0, CARD_GAP].map(dx =>
      this.add.image(W / 2 + dx, -CARD_H, '__DEFAULT')
           .setDisplaySize(CARD_W, CARD_H)
           .setAlpha(0)
           .setDepth(8)
    )

    // ── Score UI ──────────────────────────────────────────────────────────────
    this._scoreTxt = this.add.text(20, 44, 'Score: 0', {
      fontSize: '28px', color: '#ffffff', fontStyle: 'bold',
    }).setDepth(10)

    // ── Input ─────────────────────────────────────────────────────────────────
    this.input.keyboard.on('keydown-LEFT',  () => this._judge(false))
    this.input.keyboard.on('keydown-RIGHT', () => this._judge(true))

    let swipeStartX = null
    this.input.on('pointerdown', p => { swipeStartX = p.x })
    this.input.on('pointerup',   p => {
      if (swipeStartX === null) return
      const dx = p.x - swipeStartX
      swipeStartX = null
      if (Math.abs(dx) >= 60) this._judge(dx > 0)
    })

    this._spawnTriple()
  }

  // ── update ────────────────────────────────────────────────────────────────

  update(_time, delta) {
    if (!this._alive) return

    const dt = delta / 1000  // ms → seconds

    // ── Chunk physics ─────────────────────────────────────────────────────────
    if (this._chunks.length > 0) {
      const floor = H - this._rubbleRows.length * ROW_H
      let allDone = true

      for (const chunk of this._chunks) {
        if (chunk.done) continue
        allDone = false

        chunk.vy    += GRAVITY * dt
        chunk.obj.x += chunk.vx * dt
        chunk.obj.y += chunk.vy * dt

        if (chunk.obj.y >= floor) {
          chunk.obj.y = floor
          chunk.done  = true
        }
      }

      if (allDone) {
        for (const chunk of this._chunks) chunk.obj.destroy()
        this._chunks = []
        this._addRubbleRow(this._failedColors)
        this._failedColors = null
        if (!this._isRubbleFull()) {
          this._busy = false
          this._spawnTriple()
        } else {
          this._gameOver()
        }
      }

      return  // skip card-falling this frame
    }

    // ── Card falling ──────────────────────────────────────────────────────────
    if (this._busy || !this._triple) return

    const fallSpeed = Math.min(BASE_SPEED + this._score * SPEED_INC, MAX_SPEED)
    this._cardY += fallSpeed * dt
    for (const spr of this._sprites) spr.setY(this._cardY)

    const rubbleTop = H - this._rubbleRows.length * ROW_H
    if (this._cardY + CARD_H / 2 >= rubbleTop) {
      this._onCardHitFloor()
      return
    }
  }

  // ── _isRubbleFull — true when rubble leaves less than one row of clear space

  _isRubbleFull() {
    return H - this._rubbleRows.length * ROW_H < ROW_H
  }

  // ── _spawnTriple ──────────────────────────────────────────────────────────

  _spawnTriple() {
    if (this._deck.length < 6) this._deck = shuffle(generateDeck())

    const valid  = Math.random() < 0.5
    const triple = valid ? findValidTriple(this._deck) : findInvalidTriple(this._deck)

    if (!triple) {
      this._deck = shuffle(generateDeck())
      this._spawnTriple()
      return
    }

    this._triple  = triple
    this._isValid = valid

    for (const c of triple) {
      const i = this._deck.indexOf(c)
      if (i !== -1) this._deck.splice(i, 1)
    }

    this._cardY = -CARD_H / 2

    this._sprites.forEach((spr, i) => {
      spr.setTexture(cardTextureKey(triple[i]))
         .setDisplaySize(CARD_W, CARD_H)
         .setAlpha(1)
         .setX(W / 2 + (i - 1) * CARD_GAP)
         .setY(this._cardY)
    })
  }

  // ── _judge ────────────────────────────────────────────────────────────────

  _judge(playerSaysYes) {
    if (!this._alive || this._busy || this._chunks.length > 0) return

    const correct = playerSaysYes === this._isValid

    if (correct) {
      this._score++
      this._scoreTxt.setText(`Score: ${this._score}`)
      this._clearCards()
    } else {
      this._score = 0
      this._scoreTxt.setText('Score: 0')
      this._shatter()
    }
  }

  // ── _clearCards ───────────────────────────────────────────────────────────

  _clearCards() {
    this._busy = true
    this._sprites.forEach((spr, i) => {
      this.tweens.add({
        targets: spr,
        y:       spr.y - 220,
        alpha:   0,
        duration: 300,
        ease:    'Cubic.Out',
        delay:   i * 30,
        onComplete: i === 2 ? () => {
          this._triple = null
          this._busy   = false
          this._spawnTriple()
        } : undefined,
      })
    })
  }

  // ── _onCardHitFloor — card reached the rubble/floor without being judged ──

  _onCardHitFloor() {
    const colors = this._triple ? this._triple.map(c => CARD_COLORS[c.color]) : null
    this._triple = null
    for (const spr of this._sprites) spr.setAlpha(0)
    this._addRubbleRow(colors)
    if (!this._isRubbleFull()) {
      this._spawnTriple()
    } else {
      this._gameOver()
    }
  }

  // ── _shatter — wrong-answer explosion, chunks fall onto rubble ────────────

  _shatter() {
    this._busy         = true
    this._failedColors = this._triple.map(c => CARD_COLORS[c.color])
    for (const spr of this._sprites) spr.setAlpha(0)

    const chunkW = CARD_W / CHUNK_COLS
    const chunkH = CARD_H / CHUNK_ROWS

    for (let ci = 0; ci < 3; ci++) {
      const cardX     = W / 2 + (ci - 1) * CARD_GAP
      const cardColor = CARD_COLORS[this._triple[ci].color]

      for (let col = 0; col < CHUNK_COLS; col++) {
        for (let row = 0; row < CHUNK_ROWS; row++) {
          const cx    = cardX - CARD_W / 2 + col * chunkW + chunkW / 2
          const cy    = this._cardY - CARD_H / 2 + row * chunkH + chunkH / 2
          const color = ((col + row) % 2 === 0) ? cardColor : CREAM
          const obj   = this.add.rectangle(cx, cy, chunkW - 1, chunkH - 1, color)
                            .setDepth(6)
          const vx    = (Math.random() - 0.5) * 300   // ±150 px/sec
          const vy    = -(50 + Math.random() * 350)    // −50 to −400 px/sec

          this._chunks.push({ obj, vx, vy, done: false })
        }
      }
    }

    this._triple = null
  }

  // ── _addRubbleRow — push one row of coloured tiles onto the rubble stack ──

  _addRubbleRow(cardColors) {
    const row = []
    for (let i = 0; i < RUBBLE_COLS; i++) {
      row.push(cardColors ? cardColors[i % cardColors.length] : randomFrom(RUBBLE_PALETTE))
    }
    this._rubbleRows.push(row)
    this._drawRubble()
  }

  // ── _drawRubble ───────────────────────────────────────────────────────────

  _drawRubble() {
    this._rubbleGfx.clear()
    const tileW = W / RUBBLE_COLS
    this._rubbleRows.forEach((row, rowIdx) => {
      const y = H - (rowIdx + 1) * ROW_H
      row.forEach((color, col) => {
        this._rubbleGfx.fillStyle(color, 1)
        this._rubbleGfx.fillRect(col * tileW + 2, y + 2, tileW - 4, ROW_H - 4)
      })
    })
  }

  // ── _gameOver ─────────────────────────────────────────────────────────────

  _gameOver() {
    this._alive  = false
    this._triple = null
    for (const spr of this._sprites) spr.setAlpha(0)

    // Red flash overlay
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0.35).setDepth(20)
    this.tweens.add({ targets: flash, alpha: 0, duration: 600, ease: 'Linear' })

    // Flood remaining space with rubble
    const totalRows = Math.ceil(H / ROW_H)
    while (this._rubbleRows.length < totalRows) {
      this._rubbleRows.push(Array.from({ length: RUBBLE_COLS }, () => randomFrom(RUBBLE_PALETTE)))
    }
    this._drawRubble()

    this.add.text(W / 2, H / 2 - 60, 'GAME OVER', {
      fontSize: '52px', color: '#ff4444', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(25)

    this.add.text(W / 2, H / 2 + 10, `Score: ${this._score}`, {
      fontSize: '32px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(25)

    this.add.text(W / 2, H / 2 + 70, 'tap or press any key', {
      fontSize: '20px', color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(25)

    // Restart after 800 ms grace period
    this.time.delayedCall(800, () => {
      this.input.once('pointerdown', () => this.scene.restart())
      this.input.keyboard.once('keydown', () => this.scene.restart())
    })
  }
}
