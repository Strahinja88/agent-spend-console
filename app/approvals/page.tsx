import type { Metadata } from "next"

import { ApprovalQueue } from "@/features/approvals/approval-queue"

export const metadata: Metadata = { title: "Approvals" }

export default function ApprovalsPage() {
  return <ApprovalQueue />
}
