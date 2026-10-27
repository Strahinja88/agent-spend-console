"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo } from "react"

import type { DecisionFilters } from "@/lib/api/query-keys"
import { outcomeSchema } from "@/lib/domain/schemas"

/** Reads `?outcome=&agent=`; unknown values are ignored rather than sent. */
export function parseFilters(params: URLSearchParams): DecisionFilters {
  const outcome = outcomeSchema.safeParse(params.get("outcome"))
  const agentId = params.get("agent")
  return {
    ...(outcome.success && { outcome: outcome.data }),
    ...(agentId && { agentId }),
  }
}

export function filtersToSearch({ outcome, agentId }: DecisionFilters): string {
  const params = new URLSearchParams()
  if (outcome) params.set("outcome", outcome)
  if (agentId) params.set("agent", agentId)
  return params.toString()
}

/**
 * List filters live in the URL (D-018), so Back from a decision returns to
 * the same filtered list, and a filtered list can be shared as a link.
 */
export function useDecisionFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )

  const setFilters = useCallback(
    (next: DecisionFilters) => {
      const search = filtersToSearch(next)
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      })
    },
    [router, pathname],
  )

  return [filters, setFilters] as const
}
