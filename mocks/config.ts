// Knobs for the mock API. Tests turn latency and failures off and fix the clock.

export type MockConfig = {
  /** Random latency range per request, in ms. */
  latencyMs: [min: number, max: number]
  /** Share of mutations that fail with a 500 before changing anything. */
  mutationFailureRate: number
  now: () => number
}

export const mockConfig: MockConfig = {
  latencyMs: [300, 800],
  mutationFailureRate: 0.1,
  now: () => Date.now(),
}

export function configureMocks(overrides: Partial<MockConfig>) {
  Object.assign(mockConfig, overrides)
}
