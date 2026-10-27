"use client"

import { CircleAlert, CircleCheck, ExternalLink } from "lucide-react"

import { Address } from "@/components/data/address"
import { Amount } from "@/components/data/amount"
import { RelativeTime } from "@/components/data/relative-time"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { PaymentDetail } from "@/lib/api/contract"
import { useBaseBlockNumber } from "@/lib/api/payments"
import { explorerAddressUrl, explorerTxUrl } from "@/lib/chain/config"
import type { Inclusion, OnchainTx } from "@/lib/chain/types"
import type { Chain } from "@/lib/domain/types"
import { addressKey } from "@/lib/format/address"
import { formatAmount } from "@/lib/format/amount"
import { chainName } from "@/lib/format/chain"
import { formatDateTimeUtc } from "@/lib/format/date"

import { amountCheck, type OnchainView } from "./timeline-steps"

const count = new Intl.NumberFormat("en-US")

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-0.5 sm:grid-cols-[7rem_1fr]">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

function ExplorerLink({ chain, hash }: { chain: Chain; hash: string }) {
  return (
    <a
      href={explorerTxUrl(chain, hash)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex w-fit items-center gap-1 text-brand underline-offset-4 hover:underline"
    >
      View on block explorer
      <ExternalLink aria-hidden className="size-3.5" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

/** "50,979,128 · 42 confirmations" (block) or "515,751,111 · Finalized" (slot). */
function InclusionText({ inclusion }: { inclusion: Inclusion }) {
  const latest = useBaseBlockNumber(inclusion.chain === "base").data

  if (inclusion.chain === "solana") {
    return (
      <>
        {count.format(inclusion.slot)} ·{" "}
        {inclusion.finality === "finalized"
          ? "Finalized"
          : "Confirmed, not yet finalized"}
      </>
    )
  }
  const { blockNumber } = inclusion
  // The latest block can lag the receipt's on a load-balanced RPC: at least 1
  const confirmations =
    latest !== undefined && latest >= blockNumber
      ? latest - blockNumber + 1n
      : undefined
  return (
    <>
      {count.format(blockNumber)}
      {confirmations !== undefined &&
        ` · ${count.format(confirmations)} ${confirmations === 1n ? "confirmation" : "confirmations"}`}
    </>
  )
}

function BlockTime({ iso }: { iso?: string }) {
  if (!iso) return null
  return (
    <Row term="Block time">
      {formatDateTimeUtc(iso)} (<RelativeTime iso={iso} />)
    </Row>
  )
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-sunken/50 p-3 md:p-4">
      {children}
    </div>
  )
}

function ConfirmedRows({
  detail,
  tx,
}: {
  detail: PaymentDetail
  tx: Extract<OnchainTx, { state: "confirmed" }>
}) {
  const { payment, request, addressLabels } = detail
  const [transfer] = tx.transfers
  const check = amountCheck(request.amount, tx.transfers)

  return (
    <>
      <Row term="Amount">
        {transfer ? (
          <span className="flex flex-col gap-0.5">
            <Amount value={transfer.amount} className="font-medium" />
            {check === "match" ? (
              <span className="inline-flex items-center gap-1 text-xs text-status-allow-fg">
                <CircleCheck aria-hidden className="size-3.5" />
                Matches the approved amount
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-status-review-fg">
                <CircleAlert aria-hidden className="size-3.5" />
                Doesn&apos;t match the approved {formatAmount(request.amount)}
              </span>
            )}
            {tx.transfers.length > 1 && (
              <span className="text-xs text-muted-foreground">
                This transaction has {tx.transfers.length} USDC transfers;
                showing the first.
              </span>
            )}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-status-review-fg">
            <CircleAlert aria-hidden className="size-3.5" />
            No USDC transfer in this transaction
          </span>
        )}
      </Row>
      {transfer && (
        <>
          <Row term="From">
            <Address
              value={transfer.from}
              label={addressLabels[addressKey(transfer.from)]}
              explorerHref={explorerAddressUrl(payment.chain, transfer.from)}
            />
          </Row>
          <Row term="To">
            <Address
              value={transfer.to}
              label={addressLabels[addressKey(transfer.to)]}
              explorerHref={explorerAddressUrl(payment.chain, transfer.to)}
            />
          </Row>
        </>
      )}
    </>
  )
}

type OnchainCardProps = {
  detail: PaymentDetail
  onchain: Exclude<OnchainView, { kind: "simulated" }>
  onRetry: () => void
  retrying: boolean
}

/** What the chain says about the payment's transaction (design.md §6.3). */
export function OnchainCard({
  detail,
  onchain,
  onRetry,
  retrying,
}: OnchainCardProps) {
  const { payment } = detail
  const hash = payment.txHash ?? ""
  const network = chainName(payment.chain, "full")

  const retry = (
    <Button
      variant="outline"
      size="sm"
      className="w-fit"
      onClick={onRetry}
      disabled={retrying}
    >
      {retrying ? "Checking…" : "Retry"}
    </Button>
  )

  if (onchain.kind === "loading") {
    return (
      <Box>
        <span className="sr-only">Loading onchain data</span>
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
        <Skeleton className="h-3.5 w-64 max-w-full" />
      </Box>
    )
  }

  if (onchain.kind === "error") {
    return (
      <Box>
        <p>
          {onchain.rateLimited
            ? `The public ${network} RPC is limiting requests right now.`
            : `Couldn't reach the ${network} RPC.`}{" "}
          Try again in a moment.
        </p>
        {retry}
      </Box>
    )
  }

  const { tx } = onchain
  switch (tx.state) {
    case "pending":
      return (
        <Box>
          <p>Waiting for confirmation. Checking again every 5 seconds.</p>
          <ExplorerLink chain={payment.chain} hash={hash} />
        </Box>
      )
    case "not_found":
      return (
        <Box>
          <p>
            {network} doesn&apos;t know this transaction. Testnet RPCs can lag
            behind the network, so it may show up shortly.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {retry}
            <ExplorerLink chain={payment.chain} hash={hash} />
          </div>
        </Box>
      )
    case "failed":
      return (
        <Box>
          <dl className="flex flex-col gap-2">
            <Row term="Reason">{tx.reason}</Row>
            <Row term={tx.inclusion.chain === "base" ? "Block" : "Slot"}>
              <InclusionText inclusion={tx.inclusion} />
            </Row>
            <BlockTime iso={tx.blockTime} />
            <Row term="Network">{network} (testnet)</Row>
          </dl>
          <ExplorerLink chain={payment.chain} hash={hash} />
        </Box>
      )
    case "confirmed":
      return (
        <Box>
          <dl className="flex flex-col gap-2">
            <ConfirmedRows detail={detail} tx={tx} />
            <Row term={tx.inclusion.chain === "base" ? "Block" : "Slot"}>
              <InclusionText inclusion={tx.inclusion} />
            </Row>
            <BlockTime iso={tx.blockTime} />
            <Row term="Network">{network} (testnet)</Row>
          </dl>
          <ExplorerLink chain={payment.chain} hash={hash} />
        </Box>
      )
  }
}
