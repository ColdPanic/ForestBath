// (a + b + c) % 3 === 0 for each attribute → valid Set
export function isValidSet(a, b, c) {
  return ['color', 'shape', 'fill', 'count'].every(
    attr => (a[attr] + b[attr] + c[attr]) % 3 === 0
  )
}

export function findValidTriple(deck) {
  for (let i = 0; i < deck.length - 2; i++)
  for (let j = i + 1; j < deck.length - 1; j++)
  for (let k = j + 1; k < deck.length; k++)
    if (isValidSet(deck[i], deck[j], deck[k]))
      return [deck[i], deck[j], deck[k]]
  return null
}

export function findInvalidTriple(deck) {
  for (let i = 0; i < deck.length - 2; i++)
  for (let j = i + 1; j < deck.length - 1; j++)
  for (let k = j + 1; k < deck.length; k++)
    if (!isValidSet(deck[i], deck[j], deck[k]))
      return [deck[i], deck[j], deck[k]]
  return null
}
