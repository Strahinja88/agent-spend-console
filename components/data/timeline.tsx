import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleX,
  type LucideIcon,
} from "lucide-react"

import { formatDateTimeUtc } from "@/lib/format/date"
import { cn } from "@/lib/utils"

export type StepStatus = "done" | "current" | "failed" | "not_reached"

export type TimelineStepData = {
  key: string
  title: string
  status: StepStatus
  /** ISO time the step happened, if known. */
  time?: string
  children?: React.ReactNode
}

// Icon + text for every status, colour only as a third signal (design.md §1)
const STATUS: Record<
  StepStatus,
  { icon: LucideIcon; text: string; className: string }
> = {
  done: { icon: CircleCheck, text: "Done", className: "text-status-allow-fg" },
  current: {
    icon: CircleDashed,
    text: "In progress",
    className: "text-status-pending-fg",
  },
  failed: { icon: CircleX, text: "Failed", className: "text-status-deny-fg" },
  not_reached: {
    icon: Circle,
    text: "Not reached",
    className: "text-muted-foreground",
  },
}

/** A vertical list of steps with a connector between them (design.md §4). */
export function Timeline({
  steps,
  label,
}: {
  steps: TimelineStepData[]
  label: string
}) {
  return (
    <ol aria-label={label} className="flex flex-col">
      {steps.map((step, index) => (
        <TimelineStep
          key={step.key}
          step={step}
          last={index === steps.length - 1}
        />
      ))}
    </ol>
  )
}

function TimelineStep({
  step,
  last,
}: {
  step: TimelineStepData
  last: boolean
}) {
  const { icon: Icon, text, className } = STATUS[step.status]
  const reached = step.status !== "not_reached"

  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      {!last && (
        <span
          aria-hidden
          className="absolute top-6 bottom-0 left-[9px] w-px bg-border"
        />
      )}
      <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", className)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <h3
            className={cn(
              "flex flex-wrap items-baseline gap-x-2 font-medium",
              !reached && "text-muted-foreground",
            )}
          >
            {step.title}
            <span className={cn("text-xs font-normal", className)}>{text}</span>
          </h3>
          {step.time && (
            <time
              dateTime={step.time}
              className="text-xs whitespace-nowrap text-subtle-foreground tabular-nums"
            >
              {formatDateTimeUtc(step.time)}
            </time>
          )}
        </div>
        {step.children && (
          <div className={cn(!reached && "text-muted-foreground")}>
            {step.children}
          </div>
        )}
      </div>
    </li>
  )
}
