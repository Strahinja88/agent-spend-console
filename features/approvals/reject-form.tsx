"use client"

import { useEffect, useId, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type RejectFormProps = {
  onConfirm: (reason: string) => void
  onCancel: () => void
}

/** Inline reason field in the panel footer. The reason is required (design.md §6.1). */
export function RejectForm({ onConfirm, onCancel }: RejectFormProps) {
  const [reason, setReason] = useState("")
  const ref = useRef<HTMLTextAreaElement>(null)
  const id = useId()
  const trimmed = reason.trim()

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (trimmed) onConfirm(trimmed)
      }}
    >
      <Label htmlFor={id}>Reason for rejecting</Label>
      <Textarea
        id={id}
        ref={ref}
        required
        rows={3}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="destructive" disabled={!trimmed}>
          Confirm reject
        </Button>
      </div>
    </form>
  )
}
