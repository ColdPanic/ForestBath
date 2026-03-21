// A valid Set: for each attribute (color, shape, fill),
// the three cards must be all-same or all-different.
// Sum-mod-3 trick: (a+b+c) % 3 === 0 iff all-same or all-different.

export function isValidSet(a, b, c) {
  return ['color', 'shape', 'fill'].every(attr =>
    (a[attr] + b[attr] + c[attr]) % 3 === 0
  )
}
