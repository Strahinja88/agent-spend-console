"use client"

import { Check, Copy, ExternalLink } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { truncateMiddle } from "@/lib/format/address"
import { cn } from "@/lib/utils"

type AddressProps = {
  /** An address, transaction hash or signature. */
  value: string
  /** A known name ("Weather API wallet"), shown before the address. */
  label?: string
  /** What the copy button copies, for its accessible name. */
  kind?: "address" | "transaction hash"
  explorerHref?: string
  className?: string
}

/**
 * Label first, then the value in mono, middle-truncated, with a copy button
 * (design.md §4). Screen readers get the full value, not the truncated one.
 */
export function Address({
  value,
  label,
  kind = "address",
  explorerHref,
  className,
}: AddressProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 2_000)
    return () => clearTimeout(id)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // Clipboard blocked (permissions, insecure context): the full value is
      // still selectable in the title tooltip and the explorer link
    }
  }

  return (
    <span
      className={cn("inline-flex flex-wrap items-center gap-x-2", className)}
    >
      {label && <span className="font-medium">{label}</span>}
      <span className="inline-flex items-center gap-0.5">
        <span title={value} className="font-mono text-xs">
          <span aria-hidden>{truncateMiddle(value)}</span>
          <span className="sr-only">{value}</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => void copy()}
          aria-label={`Copy ${kind}`}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        </Button>
        {explorerHref && (
          <Button variant="ghost" size="icon-xs" asChild>
            <a
              href={explorerHref}
              target="_blank"
              rel="noreferrer"
              aria-label={`View ${kind} on block explorer (opens in a new tab)`}
            >
              <ExternalLink aria-hidden />
            </a>
          </Button>
        )}
        <span aria-live="polite" className="sr-only">
          {copied ? "Copied" : ""}
        </span>
      </span>
    </span>
  )
}
