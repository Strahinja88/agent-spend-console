import type { Metadata } from "next"

import { DecisionDetail } from "@/features/decisions/decision-detail"

export const metadata: Metadata = { title: "Decision" }

export default async function DecisionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <DecisionDetail id={id} />
}
