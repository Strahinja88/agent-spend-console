import type { Metadata } from "next"
import { Suspense } from "react"

import { DecisionsList } from "@/features/decisions/decisions-list"

export const metadata: Metadata = { title: "Decisions" }

export default function DecisionsPage() {
  // useSearchParams (filters in the URL) needs a Suspense boundary to build
  return (
    <Suspense>
      <DecisionsList />
    </Suspense>
  )
}
