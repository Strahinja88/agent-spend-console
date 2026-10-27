import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  cancelApproval,
  commitApproval,
  deferApproval,
  flushApprovals,
  isApprovalPending,
  resetPendingApprovals,
} from "./pending-approvals"

beforeEach(() => resetPendingApprovals())

function pending(id: string) {
  const approval = { send: vi.fn(), dismiss: vi.fn() }
  deferApproval(id, approval)
  return approval
}

describe("pending approvals", () => {
  it("sends once on commit, however many times the toast closes", () => {
    const a = pending("dec_1")
    commitApproval("dec_1")
    commitApproval("dec_1")
    expect(a.send).toHaveBeenCalledTimes(1)
    expect(isApprovalPending("dec_1")).toBe(false)
  })

  it("Undo cancels, so a later close sends nothing", () => {
    const a = pending("dec_1")
    expect(cancelApproval("dec_1")).toBe(true)
    commitApproval("dec_1")
    expect(a.send).not.toHaveBeenCalled()
  })

  it("Undo after sending reports that it was too late", () => {
    pending("dec_1")
    commitApproval("dec_1")
    expect(cancelApproval("dec_1")).toBe(false)
  })

  it("flush sends everything pending and closes the toasts", () => {
    const a = pending("dec_1")
    const b = pending("dec_2")
    flushApprovals()
    expect(a.send).toHaveBeenCalledTimes(1)
    expect(b.send).toHaveBeenCalledTimes(1)
    expect(a.dismiss).toHaveBeenCalled()
    // The toast closing afterwards doesn't send again
    commitApproval("dec_1")
    expect(a.send).toHaveBeenCalledTimes(1)
  })
})
