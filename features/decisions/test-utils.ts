import { fetchJson } from "@/lib/api/client"
import { decisionsResponse, type DecisionListItem } from "@/lib/api/contract"
import { usdc } from "@/lib/format/amount"

/** A seeded decision by agent, amount and UTC day (the sketches in design.md). */
export async function findSeeded(
  agentId: string,
  amount: string,
  day: string,
): Promise<DecisionListItem> {
  const items = await fetchJson("/api/decisions", decisionsResponse)
  const item = items.find(
    (i) =>
      i.request.agentId === agentId &&
      i.request.amount === usdc(amount) &&
      i.request.createdAt.startsWith(day),
  )
  if (!item) throw new Error(`No seeded decision ${agentId} ${amount} ${day}`)
  return item
}
