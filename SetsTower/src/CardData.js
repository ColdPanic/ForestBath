// Simplified Set ruleset: color, shape, fill only (no count).
// 3 × 3 × 3 = 27 unique cards per deck.

export const Color = Object.freeze({ RED: 0, GREEN: 1, PURPLE: 2 })
export const Shape = Object.freeze({ DIAMOND: 0, OVAL: 1, SQUIGGLE: 2 })
export const Fill  = Object.freeze({ SOLID: 0, STRIPED: 1, EMPTY: 2 })

export class CardData {
  constructor(color, shape, fill) {
    this.color = color
    this.shape = shape
    this.fill  = fill
  }
}

export function generateDeck() {
  const deck = []
  for (let color = 0; color < 3; color++)
  for (let shape = 0; shape < 3; shape++)
  for (let fill  = 0; fill  < 3; fill++)
    deck.push(new CardData(color, shape, fill))
  return deck
}

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
