import { Shape, Fill } from './CardData.js'

export const CARD_W = 110
export const CARD_H = 170
const CARD_R  = 10
const SYM_W   = 76
const SYM_H   = 34
const SYM_GAP = 10

const COLORS = ['#e74c3c', '#27ae60', '#8e44ad']  // red, green, purple

export function cardTextureKey(card) {
  return `card_${card.color}_${card.shape}_${card.fill}_${card.count}`
}

// Generates (or reuses) a canvas texture for the given card.
export function ensureCardTexture(scene, card) {
  const key = cardTextureKey(card)
  if (scene.textures.exists(key)) return key

  const tex = scene.textures.createCanvas(key, CARD_W, CARD_H)
  const ctx = tex.getContext()

  // Background
  _roundRect(ctx, 2, 2, CARD_W - 4, CARD_H - 4, CARD_R)
  ctx.fillStyle = '#faf8f0'
  ctx.fill()
  ctx.strokeStyle = '#cccccc'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Symbols
  const color   = COLORS[card.color]
  const count   = card.count
  const totalH  = count * SYM_H + (count - 1) * SYM_GAP
  const startY  = (CARD_H - totalH) / 2

  for (let i = 0; i < count; i++) {
    const cy = startY + i * (SYM_H + SYM_GAP) + SYM_H / 2
    _drawSymbol(ctx, CARD_W / 2, cy, SYM_W, SYM_H, card.shape, card.fill, color)
  }

  tex.refresh()
  return key
}

// ─── private ────────────────────────────────────────────────────────────────

function _drawSymbol(ctx, cx, cy, w, h, shape, fill, color) {
  ctx.save()
  ctx.translate(cx, cy)

  // Build the closed path for this shape
  _shapePath(ctx, w, h, shape)

  if (fill === Fill.SOLID) {
    ctx.fillStyle = color
    ctx.fill()
  } else if (fill === Fill.STRIPED) {
    // Clip to shape, then draw horizontal stripes
    ctx.save()
    ctx.clip()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    for (let y = -h / 2; y <= h / 2; y += 5) {
      ctx.beginPath()
      ctx.moveTo(-w / 2 - 2, y)
      ctx.lineTo(w / 2 + 2, y)
      ctx.stroke()
    }
    ctx.restore()
    // Rebuild path after clip restore (clip consumes the path)
    _shapePath(ctx, w, h, shape)
  }
  // EMPTY: no fill, just stroke below

  ctx.strokeStyle = color
  ctx.lineWidth = 2.5
  ctx.stroke()

  ctx.restore()
}

function _shapePath(ctx, w, h, shape) {
  const hw = w / 2, hh = h / 2
  ctx.beginPath()

  if (shape === Shape.DIAMOND) {
    ctx.moveTo(0, -hh)
    ctx.lineTo(hw, 0)
    ctx.lineTo(0, hh)
    ctx.lineTo(-hw, 0)
    ctx.closePath()

  } else if (shape === Shape.OVAL) {
    ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2)

  } else { // SQUIGGLE — S-curve with rounded end caps
    const th = hh * 0.42  // half-thickness of the strip
    // Top edge: S-wave from left to right
    //   CP1 pulls UP at the left → CP2 pulls DOWN at the right → creates S-inflection
    ctx.moveTo(-hw, -th)
    ctx.bezierCurveTo(-hw * 0.3, -hh * 0.9,  hw * 0.3,  hh * 0.3,  hw, -th)
    // Right rounded cap (clockwise arc: top → right bulge → bottom)
    ctx.arc(hw, 0, th, -Math.PI / 2, Math.PI / 2, false)
    // Bottom edge: mirror S-wave from right to left
    ctx.bezierCurveTo( hw * 0.3,  hh * 0.9, -hw * 0.3, -hh * 0.3, -hw,  th)
    // Left rounded cap (clockwise arc: bottom → left bulge → top)
    ctx.arc(-hw, 0, th, Math.PI / 2, -Math.PI / 2, false)
    ctx.closePath()
  }
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x,     y + h, x,     y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x,     y,     x + r, y)
  ctx.closePath()
}
