import type { Metadata } from "next"
import { Scale } from "lucide-react"

import { EmptyState } from "@/components/data/empty-state"

export const metadata: Metadata = { title: "Decisions" }

// Placeholder: the decisions list is built in phase 4.
export default function DecisionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Decisions</h1>
      <EmptyState
        icon={Scale}
        title="Decisions coming soon"
        description="Every allow, review and deny decision will be listed here."
      />
    </div>
  )
}
