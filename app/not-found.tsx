import { SearchX } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { EmptyState } from "@/components/data/empty-state"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Page not found" }

export default function NotFound() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <EmptyState
        icon={SearchX}
        title="Nothing at this address"
        description="The link may be wrong or out of date."
        action={
          <Button variant="outline" asChild>
            <Link href="/approvals">Go to approvals</Link>
          </Button>
        }
      />
    </div>
  )
}
