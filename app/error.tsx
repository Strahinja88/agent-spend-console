"use client"

import { ErrorState } from "@/components/data/error-state"

/** Last resort for a render error. Screens handle failed loads themselves. */
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <ErrorState
        title="This page couldn't be shown"
        description="Try again. If it keeps happening, reload the page; the demo data starts over."
        onRetry={reset}
      />
    </div>
  )
}
