import type { Metadata } from "next"

import { PaymentTimeline } from "@/features/payments/payment-timeline"

export const metadata: Metadata = { title: "Payment" }

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PaymentTimeline id={id} />
}
