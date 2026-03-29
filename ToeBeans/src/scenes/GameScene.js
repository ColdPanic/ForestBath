import Phaser from 'phaser'
import { generateDeck, shuffle } from '../CardData.js'
import { findValidTriple, findInvalidTriple } from '../SetValidator.js'
import { ensureCardTexture, cardTextureKey, CARD_W, CARD_H } from '../CardSprite.js'

// ── Layout ────────────────────────────────────────────────────────────────────
const W = 390
const H = 844

const CARD_GAP = 124
const REEL_L   = W / 2 - CARD_GAP
const REEL_C   = W / 2
const REEL_R_X = W / 2 + CARD_GAP

const REEL_R  = 380
const WIN_Y   = Math.round(H * 0.46)
const WIN_TOP = WIN_Y - 220
const WIN_BOT = WIN_Y + 220
const WIN_H   = WIN_BOT - WIN_TOP

const SPAWN_ANGLE = -1.57
const EXIT_ANGLE  =  1.57
const SLOT_SPACE  = 0.54
const JUDGE_ZONE  = 0.22

const BASE_SPEED = 0.10
const SPEED_BUMP = 0.018   // added to speed on each correct answer
const MAX_SPEED  = 0.55

const GRAVITY    = 900
const CHUNK_COLS = 3
const CHUNK_ROWS = 4

const CARD_COLORS = [0xe74c3c, 0x27ae60, 0x8e44ad]
const CREAM       = 0xfaf8f0

// Highlight bar spans all three cards
const BAR_W = CARD_GAP * 2 + CARD_W + 24

function project(angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return {
    y:      WIN_Y + REEL_R * s,
    scaleY: Math.max(0.03, c),
    alpha:  Math.max(0,    c),
  }
}

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }

  create() {
    for (const card of generateDeck()) ensureCardTexture(this, card)

    this._deck        = shuffle(generateDeck())
    this._score       = 0
    this._speed       = BASE_SPEED
    this._slots       = []
    this._queueOffset = 0

    // ── Background ────────────────────────────────────────────────────────────
    this.add.graphics().setDepth(0)
      .fillStyle(0x1a1020, 1)
      .fillRect(0, 0, W, H)

    // ── Reel background ───────────────────────────────────────────────────────
    const reelBg = this.add.graphics().setDepth(1)
    reelBg.fillStyle(0x0c0c1a, 1)
    reelBg.fillRect(0, WIN_TOP, W, WIN_H)
    reelBg.lineStyle(1, 0x1e1e38, 1)
    reelBg.lineBetween(REEL_L + CARD_GAP / 2, WIN_TOP, REEL_L + CARD_GAP / 2, WIN_BOT)
    reelBg.lineBetween(REEL_C + CARD_GAP / 2, WIN_TOP, REEL_C + CARD_GAP / 2, WIN_BOT)

    // ── Machine body ─────────────────────────────────────────────────────────
    const body = this.add.graphics().setDepth(14)
    body.fillStyle(0x16102a, 1)
    body.fillRect(0, 0,       W, WIN_TOP)
    body.fillRect(0, WIN_BOT, W, H - WIN_BOT)
    body.fillStyle(0x2a1e4a, 1)
    body.fillRect(0, WIN_TOP - 6, W, 6)
    body.fillRect(0, WIN_BOT,     W, 6)
    body.fillStyle(0x000000, 0.55)
    body.fillRect(0, WIN_TOP,      W, 38)
    body.fillRect(0, WIN_BOT - 38, W, 38)

    // ── Window frame ─────────────────────────────────────────────────────────
    const frame = this.add.graphics().setDepth(15)
    frame.lineStyle(4, 0x5a4080, 1)
    frame.beginPath()
    frame.moveTo(2, WIN_BOT + 4)
    frame.lineTo(2, WIN_TOP - 4)
    frame.lineTo(W - 2, WIN_TOP - 4)
    frame.strokePath()
    frame.lineStyle(4, 0x1a0f30, 1)
    frame.beginPath()
    frame.moveTo(W - 2, WIN_TOP - 4)
    frame.lineTo(W - 2, WIN_BOT + 4)
    frame.lineTo(2,     WIN_BOT + 4)
    frame.strokePath()
    frame.lineStyle(2, 0x3a2860, 1)
    frame.strokeRect(1, WIN_TOP, W - 2, WIN_H)

    // ── Win line ──────────────────────────────────────────────────────────────
    frame.lineStyle(2, 0xffd700, 0.85)
    frame.lineBetween(0, WIN_Y, W, WIN_Y)
    frame.fillStyle(0xffd700, 0.85)
    frame.fillTriangle(0, WIN_Y - 9, 0, WIN_Y + 9, 16,     WIN_Y)
    frame.fillTriangle(W, WIN_Y - 9, W, WIN_Y + 9, W - 16, WIN_Y)

    // ── Score ─────────────────────────────────────────────────────────────────
    this._scoreTxt = this.add.text(W / 2, WIN_TOP - 34, 'Score: 0', {
      fontSize: '26px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20)

    // ── Hint labels ───────────────────────────────────────────────────────────
    this.add.text(W / 4, WIN_BOT + 38, '← Not a Set', {
      fontSize: '21px', color: '#ff6b6b', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
      backgroundColor: '#00000099', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setDepth(20)

    this.add.text(W * 3 / 4, WIN_BOT + 38, 'Set →', {
      fontSize: '21px', color: '#44ff88', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
      backgroundColor: '#00000099', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setDepth(20)

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

    for (let a = SPAWN_ANGLE; a < JUDGE_ZONE + SLOT_SPACE; a += SLOT_SPACE) {
      this._spawnSlot(a)
    }
  }

  // ── update ─────────────────────────────────────────────────────────────────

  update(_time, delta) {
    const dt = delta / 1000
    const da = this._speed * dt

    // Only advance active (un-locked) slots
    for (const slot of this._slots) {
      if (slot.state === 'active') slot.angle += da
    }

    // ── Chunk physics — fall off screen and clean up ───────────────────────
    for (const slot of this._slots) {
      if (!slot.chunks.length) continue
      let allDone = true
      for (const c of slot.chunks) {
        if (c.done) continue
        allDone = false
        c.vy    += GRAVITY * dt
        c.obj.x += c.vx * dt
        c.obj.y += c.vy * dt
        if (c.obj.y > H + 40) { c.obj.destroy(); c.done = true }
      }
      if (allDone && slot.state === 'shattering') {
        slot.chunks = []
        slot.state  = 'done'
      }
    }

    // ── Slots rolling past exit without judgment — silently discard ───────
    for (const slot of this._slots) {
      if (slot.state !== 'active' || slot.angle <= EXIT_ANGLE) continue
      for (const spr of slot.sprites) spr.destroy()
      slot.state = 'done'
    }

    this._slots = this._slots.filter(s => s.state !== 'done')

    // ── Keep reels fed ────────────────────────────────────────────────────
    this._queueOffset += da
    if (this._queueOffset >= SLOT_SPACE) {
      this._queueOffset -= SLOT_SPACE
      this._spawnSlot(SPAWN_ANGLE)
    }

    // ── Render active slots ───────────────────────────────────────────────
    for (const slot of this._slots) {
      if (slot.state !== 'active') continue
      const { y, scaleY, alpha } = project(slot.angle)
      const depth = Math.max(1, Math.round(scaleY * 8))
      const cols  = [REEL_L, REEL_C, REEL_R_X]
      for (let i = 0; i < 3; i++) {
        slot.sprites[i]
          .setPosition(cols[i], y)
          .setDisplaySize(CARD_W, CARD_H * scaleY)
          .setAlpha(alpha)
          .setDepth(depth)
      }
    }
  }

  // ── _spawnSlot ─────────────────────────────────────────────────────────────

  _spawnSlot(angle) {
    if (this._deck.length < 6) this._deck = shuffle(generateDeck())

    const valid  = Math.random() < 0.5
    const triple = valid ? findValidTriple(this._deck) : findInvalidTriple(this._deck)

    if (!triple) {
      this._deck = shuffle(generateDeck())
      return this._spawnSlot(angle)
    }

    for (const c of triple) {
      const i = this._deck.indexOf(c)
      if (i !== -1) this._deck.splice(i, 1)
    }

    const { y, scaleY, alpha } = project(angle)
    const cols = [REEL_L, REEL_C, REEL_R_X]

    const sprites = triple.map((card, i) =>
      this.add.image(cols[i], y, cardTextureKey(card))
        .setDisplaySize(CARD_W, CARD_H * scaleY)
        .setAlpha(alpha)
        .setDepth(1)
    )

    this._slots.push({
      triple, isValid: valid, angle, sprites,
      state: 'active', chunks: [],
    })
  }

  // ── _judge ─────────────────────────────────────────────────────────────────

  _judge(playerSaysYes) {
    const slot = this._slots.find(s => s.state === 'active' && Math.abs(s.angle) < JUDGE_ZONE)
    if (!slot) return

    if (playerSaysYes === slot.isValid) {
      this._score++
      this._scoreTxt.setText(`Score: ${this._score}`)
      this._lockAndClear(slot)
    } else {
      this._score = 0
      this._scoreTxt.setText('Score: 0')
      this._shatterSlot(slot)
    }
  }

  // ── _lockAndClear — locking flourish, then fly off + speed bump ────────────

  _lockAndClear(slot) {
    slot.state = 'locking'

    const { y, scaleY } = project(slot.angle)
    const barH = CARD_H * scaleY + 18

    // ── Gold highlight bar behind all three cards ──────────────────────────
    const glow = this.add.rectangle(REEL_C, y, BAR_W, barH, 0xffd700)
      .setAlpha(0).setDepth(7)

    // Flash in quickly, linger, then dissolve with the cards
    this.tweens.add({
      targets:  glow,
      alpha:    0.38,
      duration: 80,
      ease:     'Linear',
    })

    // ── Subtle border lines on each card ──────────────────────────────────
    const borderGfx = this.add.graphics().setDepth(13).setAlpha(0)
    const cols      = [REEL_L, REEL_C, REEL_R_X]
    const cardH     = CARD_H * scaleY
    for (const cx of cols) {
      borderGfx.lineStyle(3, 0xffd700, 1)
      borderGfx.strokeRect(cx - CARD_W / 2 - 2, y - cardH / 2 - 2, CARD_W + 4, cardH + 4)
    }
    this.tweens.add({ targets: borderGfx, alpha: 1, duration: 80, ease: 'Linear' })

    // ── Card pop — scale up slightly then hold ─────────────────────────────
    for (const spr of slot.sprites) {
      this.tweens.add({
        targets:  spr,
        scaleX:   spr.scaleX * 1.06,
        scaleY:   spr.scaleY * 1.06,
        duration: 90,
        ease:     'Back.Out',
      })
    }

    // ── After hold: cards fly up, glow dissolves, speed bumps ─────────────
    this.time.delayedCall(220, () => {
      // Dissolve glow and border together with the cards
      this.tweens.add({ targets: [glow, borderGfx], alpha: 0, duration: 280, ease: 'Cubic.Out',
        onComplete: () => { glow.destroy(); borderGfx.destroy() },
      })

      slot.sprites.forEach((spr, i) => {
        this.tweens.add({
          targets:  spr,
          y:        spr.y - 190,
          alpha:    0,
          duration: 300,
          ease:     'Cubic.Out',
          delay:    i * 35,
          onComplete: () => spr.destroy(),
        })
      })

      this.time.delayedCall(380, () => {
        slot.state   = 'done'
        this._speed  = Math.min(this._speed + SPEED_BUMP, MAX_SPEED)
      })
    })
  }

  // ── _shatterSlot ───────────────────────────────────────────────────────────

  _shatterSlot(slot) {
    slot.state = 'shattering'

    const { y, scaleY } = project(slot.angle)
    const chunkW = CARD_W / CHUNK_COLS
    const chunkH = (CARD_H * scaleY) / CHUNK_ROWS

    for (const spr of slot.sprites) spr.setAlpha(0)

    const cols = [REEL_L, REEL_C, REEL_R_X]
    for (let ci = 0; ci < 3; ci++) {
      const cardX     = cols[ci]
      const cardColor = CARD_COLORS[slot.triple[ci].color]

      for (let col = 0; col < CHUNK_COLS; col++) {
        for (let row = 0; row < CHUNK_ROWS; row++) {
          const cx    = cardX - CARD_W / 2 + col * chunkW + chunkW / 2
          const cy    = y - (CARD_H * scaleY) / 2 + row * chunkH + chunkH / 2
          const color = ((col + row) % 2 === 0) ? cardColor : CREAM
          const obj   = this.add.rectangle(cx, cy, chunkW - 1, chunkH - 1, color).setDepth(6)
          slot.chunks.push({
            obj,
            vx: (Math.random() - 0.5) * 300,
            vy: -(80 + Math.random() * 340),
            done: false,
          })
        }
      }
    }
  }
}
