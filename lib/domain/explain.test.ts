import { describe, expect, it } from "vitest"

import { reviewSentence } from "./explain"
import { decision } from "./test-fixtures"

const review = decision({
  outcome: "review",
  reasonCode: "REVIEW_THRESHOLD",
  decidedAt: "2026-10-27T12:10:00.000Z",
})

describe("reviewSentence", () => {
  it("says who approved and when", () => {
    expect(
      reviewSentence({
        ...review,
        reviewResult: "approved",
        reviewedBy: "M. Ilić",
        reviewedAt: "2026-10-27T12:14:00.000Z",
      }),
    ).toBe("Approved by M. Ilić at 12:14 UTC.")
  })

  it("quotes the reason for a rejection", () => {
    expect(
      reviewSentence({
        ...review,
        reviewResult: "rejected",
        reviewedBy: "J. Perić",
        reviewedAt: "2026-10-27T09:31:00.000Z",
        reviewReason: "Duplicate of yesterday's GPU order.",
      }),
    ).toBe(
      "Rejected by J. Perić at 09:31 UTC: “Duplicate of yesterday's GPU order.”",
    )
  })

  it("adds the date when the review was on a later day", () => {
    expect(
      reviewSentence({
        ...review,
        reviewResult: "approved",
        reviewedBy: "M. Ilić",
        reviewedAt: "2026-10-28T08:05:00.000Z",
      }),
    ).toBe("Approved by M. Ilić on 28 Oct at 08:05 UTC.")
  })

  it("says it's waiting when there's no result yet", () => {
    expect(reviewSentence(review)).toBe("Waiting for a reviewer.")
  })

  it("has nothing to say for allow and deny", () => {
    expect(reviewSentence(decision())).toBeUndefined()
    expect(
      reviewSentence(
        decision({ outcome: "deny", reasonCode: "LIMIT_TX_EXCEEDED" }),
      ),
    ).toBeUndefined()
  })
})
