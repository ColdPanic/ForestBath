export const Color = Object.freeze({ RED: 0, GREEN: 1, PURPLE: 2 })
export const Shape = Object.freeze({ DIAMOND: 0, OVAL: 1, SQUIGGLE: 2 })
export const Fill  = Object.freeze({ SOLID: 0, STRIPED: 1, EMPTY: 2 })

export class CardData {
  constructor(color, shape, fill, count) {
    this.color = color  // 0–2
    this.shape = shape  // 0–2
    this.fill  = fill   // 0–2
    this.count = count  // 1–3
  }
}

export function generateDeck() {
  const deck = []
  for (let color = 0; color < 3; color++)
  for (let shape = 0; shape < 3; shape++)
  for (let fill  = 0; fill  < 3; fill++)
  for (let count = 1; count <= 3; count++)
    deck.push(new CardData(color, shape, fill, count))
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
