import { reviewSentence } from "@/lib/domain/explain"
import type { Decision } from "@/lib/domain/types"

import { Card } from "./card"

/** The decision in plain language, then what review made of it (design.md §6.2b). */
export function ExplanationCard({ decision }: { decision: Decision }) {
  const review = reviewSentence(decision)

  return (
    <Card title="Explanation">
      <div className="flex flex-col gap-2">
        <p>{decision.reason}</p>
        {review && <p className="font-medium">{review}</p>}
        <p className="text-muted-foreground">
          Code: <code className="font-mono text-xs">{decision.reasonCode}</code>
        </p>
      </div>
    </Card>
  )
}
