"use client"

import { CircleCheck, CircleX, Loader2 } from "lucide-react"
import { useId, useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useJwks } from "@/lib/api/decisions"
import { truncateMiddle } from "@/lib/format/address"
import {
  decodeVerdict,
  tamperVerdict,
  type DecodedVerdict,
  type TamperedVerdict,
} from "@/lib/verdict/decode"
import { verifyVerdict, type VerifyResult } from "@/lib/verdict/verify"

import { Card } from "./card"

function safeDecode(jwt: string): DecodedVerdict | undefined {
  try {
    return decodeVerdict(jwt)
  } catch {
    return undefined
  }
}

function safeTamper(jwt: string): TamperedVerdict | undefined {
  try {
    return tamperVerdict(jwt)
  } catch {
    return undefined
  }
}

// Code blocks scroll sideways on narrow screens, so they take focus: keyboard
// users can then scroll them with the arrow keys (WCAG 2.1.1).
const codeBlock =
  "overflow-x-auto rounded-md border border-border bg-surface-sunken p-3 font-mono text-xs leading-5"

/** The payload as JSON, one claim per line, with the tampered one tagged. */
function PayloadBlock({
  payload,
  tampered,
}: {
  payload: Record<string, unknown>
  tampered?: TamperedVerdict
}) {
  const entries = Object.entries(payload)
  return (
    <pre tabIndex={0} className={codeBlock}>
      {"{\n"}
      {entries.map(([key, value], index) => {
        const line = `  ${JSON.stringify(key)}: ${JSON.stringify(value)}${index < entries.length - 1 ? "," : ""}`
        if (tampered?.field !== key) return `${line}\n`
        return (
          <span key={key}>
            <span className="bg-status-review-bg text-status-review-fg">
              {line}
            </span>
            <span className="ml-2 rounded-sm border border-status-review-border px-1 font-sans text-status-review-fg">
              changed, was {JSON.stringify(tampered.from)}
            </span>
            {"\n"}
          </span>
        )
      })}
      {"}"}
    </pre>
  )
}

function ResultLine({ result }: { result: VerifyResult }) {
  if (result.ok) {
    return (
      <p className="flex items-start gap-2 rounded-md border border-status-allow-border bg-status-allow-bg px-3 py-2 text-status-allow-fg">
        <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Signature valid · key{" "}
          <code className="font-mono text-xs" title={result.kid}>
            {truncateMiddle(result.kid)}
          </code>{" "}
          · {result.alg}
        </span>
      </p>
    )
  }
  return (
    <p className="flex items-start gap-2 rounded-md border border-status-deny-border bg-status-deny-bg px-3 py-2 text-status-deny-fg">
      <CircleX aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>Signature invalid: {result.message}</span>
    </p>
  )
}

/**
 * The signed verdict, decoded, with a Verify button that checks it against
 * the JWKS in the browser, and a Tamper switch that changes one claim so
 * verification fails (design.md §6.2b, D-017).
 */
export function VerdictPanel({ jwt }: { jwt: string }) {
  const jwks = useJwks()
  const tamperId = useId()
  const [tamperOn, setTamperOn] = useState(false)
  const [verifying, setVerifying] = useState(false)
  // Kept with the token it was for, so changing the token clears the result
  const [result, setResult] = useState<{ jwt: string; value: VerifyResult }>()

  const tampered = tamperOn ? safeTamper(jwt) : undefined
  const current = tampered?.jwt ?? jwt
  const decoded = safeDecode(current)
  const shown = result?.jwt === current ? result.value : undefined

  async function verify() {
    if (!jwks.data) return
    setVerifying(true)
    try {
      const value = await verifyVerdict(current, jwks.data)
      setResult({ jwt: current, value })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <Card title="Signed verdict">
      {decoded ? (
        <>
          <div className="flex flex-col gap-1">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Header
            </h3>
            <pre tabIndex={0} className={codeBlock}>
              {JSON.stringify(decoded.header, null, 2)}
            </pre>
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Payload
            </h3>
            <PayloadBlock payload={decoded.payload} tampered={tampered} />
          </div>
          <details className="text-muted-foreground">
            <summary className="w-fit cursor-pointer">Encoded token</summary>
            <p className={`${codeBlock} mt-1 break-all whitespace-normal`}>
              {current}
            </p>
          </details>
        </>
      ) : (
        <p className="text-muted-foreground">This verdict can’t be decoded.</p>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button
          onClick={() => void verify()}
          disabled={!jwks.data || verifying}
        >
          {verifying && (
            <Loader2 aria-hidden className="motion-safe:animate-spin" />
          )}
          Verify signature
        </Button>
        <div className="flex items-center gap-2">
          <Switch
            id={tamperId}
            checked={tamperOn}
            onCheckedChange={setTamperOn}
            disabled={!safeTamper(jwt)}
          />
          <Label htmlFor={tamperId}>Tamper with payload</Label>
        </div>
      </div>

      {tampered && (
        <p className="text-muted-foreground">
          Changed “{tampered.field}” from “{tampered.from}” to “{tampered.to}”.
          The header and signature are the original ones.
        </p>
      )}

      {jwks.isPending && (
        <p className="text-muted-foreground">Loading signing keys…</p>
      )}
      {jwks.isError && (
        <div className="flex flex-wrap items-center gap-2 text-status-deny-fg">
          <p>
            Couldn’t load the signing keys, so the verdict can’t be checked.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void jwks.refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      <div aria-live="polite">{shown && <ResultLine result={shown} />}</div>
    </Card>
  )
}
