import { beforeEach, describe, expect, it } from "vitest"

import {
  hiddenDecisions,
  hideDecision,
  pruneHidden,
  resetReviewOverlay,
  restoreDecision,
} from "./review-overlay"

beforeEach(() => resetReviewOverlay())

describe("review overlay", () => {
  it("hides and restores", () => {
    hideDecision("dec_1")
    hideDecision("dec_2")
    expect([...hiddenDecisions()]).toEqual(["dec_1", "dec_2"])
    restoreDecision("dec_1")
    expect([...hiddenDecisions()]).toEqual(["dec_2"])
  })

  it("keeps ids the server still lists, drops the rest", () => {
    hideDecision("dec_1")
    hideDecision("dec_2")
    pruneHidden(["dec_2", "dec_3"])
    expect([...hiddenDecisions()]).toEqual(["dec_2"])
  })

  it("only replaces the snapshot when something changes", () => {
    hideDecision("dec_1")
    const before = hiddenDecisions()
    hideDecision("dec_1")
    pruneHidden(["dec_1"])
    restoreDecision("dec_9")
    expect(hiddenDecisions()).toBe(before)
  })
})
