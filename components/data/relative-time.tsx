"use client"

import { useEffect, useState } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatAbsolute, formatRelative } from "@/lib/format/date"

/** Current time, refreshed every `intervalMs`. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** "3 min ago", with UTC + local time in a tooltip (design.md §8.2). */
export function RelativeTime({ iso }: { iso: string }) {
  const now = useNow()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time dateTime={iso} className="whitespace-nowrap">
          {formatRelative(iso, now)}
        </time>
      </TooltipTrigger>
      <TooltipContent>{formatAbsolute(iso)}</TooltipContent>
    </Tooltip>
  )
}
