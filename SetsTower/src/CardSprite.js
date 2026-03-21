import { Shape, Fill } from './CardData.js'

// Card dimensions tuned for a 9×9 grid in a 390px-wide canvas.
export const CARD_W = 40
export const CARD_H = 56
const CARD_R = 4

// Single symbol per card (no count attribute).
const SYM_W = 28
const SYM_H = 16

const COLORS = ['#e74c3c', '#27ae60', '#8e44ad']

export function cardTextureKey(card) {
  return `maze_${card.color}_${card.shape}_${card.fill}`
}

export function ensureCardTexture(scene, card) {
  const key = cardTextureKey(card)
  if (scene.textures.exists(key)) return key

  const tex = scene.textures.createCanvas(key, CARD_W, CARD_H)
  const ctx = tex.getContext()

  // Card background
  _roundRect(ctx, 2, 2, CARD_W - 4, CARD_H - 4, CARD_R)
  ctx.fillStyle = '#faf8f0'
  ctx.fill()
  ctx.strokeStyle = '#cccccc'
  ctx.lineWidth = 1
  ctx.stroke()

  // One symbol, centred
  _drawSymbol(ctx, CARD_W / 2, CARD_H / 2, SYM_W, SYM_H, card.shape, card.fill, COLORS[card.color])

  tex.refresh()
  return key
}

// ─── private ────────────────────────────────────────────────────────────────

function _drawSymbol(ctx, cx, cy, w, h, shape, fill, color) {
  ctx.save()
  ctx.translate(cx, cy)
  _shapePath(ctx, w, h, shape)

  if (fill === Fill.SOLID) {
    ctx.fillStyle = color
    ctx.fill()
  } else if (fill === Fill.STRIPED) {
    ctx.save()
    ctx.clip()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    for (let y = -h / 2; y <= h / 2; y += 4) {
      ctx.beginPath()
      ctx.moveTo(-w / 2 - 2, y)
      ctx.lineTo(w / 2 + 2, y)
      ctx.stroke()
    }
    ctx.restore()
    _shapePath(ctx, w, h, shape)
  }

  ctx.strokeStyle = color
  ctx.lineWidth = 2
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

  } else { // SQUIGGLE
    const th = hh * 0.42
    ctx.moveTo(-hw, -th)
    ctx.bezierCurveTo(-hw * 0.3, -hh * 0.9,  hw * 0.3,  hh * 0.3,  hw, -th)
    ctx.arc(hw, 0, th, -Math.PI / 2, Math.PI / 2, false)
    ctx.bezierCurveTo( hw * 0.3,  hh * 0.9, -hw * 0.3, -hh * 0.3, -hw,  th)
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
