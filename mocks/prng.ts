// Seeded PRNG (mulberry32) so the seed is the same on every load, with no
// faker dependency. Floats here only pick indices and integers, never money.

export type Rng = ReturnType<typeof createRng>

export function createRng(seed: number) {
  let state = seed >>> 0

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }

  /** Integer in [min, max], both inclusive. */
  function int(min: number, max: number): number {
    return min + Math.floor(next() * (max - min + 1))
  }

  function pick<T>(items: readonly T[]): T {
    const item = items[int(0, items.length - 1)]
    if (item === undefined) throw new Error("pick() from an empty list")
    return item
  }

  function chance(probability: number): boolean {
    return next() < probability
  }

  function hex(length: number): string {
    let out = ""
    while (out.length < length) out += int(0, 15).toString(16)
    return out
  }

  return { next, int, pick, chance, hex }
}
