import type { Metadata } from "next"
import { Route } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/data/empty-state"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Payment" }

// Placeholder: the payment timeline is built in phase 5.
export default function PaymentPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Payment</h1>
      <EmptyState
        icon={Route}
        title="Payment timeline coming soon"
        description="The steps from request to onchain confirmation will be shown here."
        action={
          <Button variant="outline" asChild>
            <Link href="/decisions">Back to decisions</Link>
          </Button>
        }
      />
    </div>
  )
}
