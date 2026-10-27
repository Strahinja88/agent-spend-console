import type { Metadata } from "next"
import { Inbox } from "lucide-react"

import { EmptyState } from "@/components/data/empty-state"

export const metadata: Metadata = { title: "Approvals" }

// Placeholder: the approval queue is built in phase 3.
export default function ApprovalsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Approvals</h1>
      <EmptyState
        icon={Inbox}
        title="Approval queue coming soon"
        description="Requests waiting for review will appear here."
      />
    </div>
  )
}
