import { CircleAlert, CircleCheck, CircleX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { DecisionFilters as Filters } from "@/lib/api/query-keys"
import { outcomeSchema } from "@/lib/domain/schemas"
import type { Agent } from "@/lib/domain/types"

const ALL = "all"

// Filter by rule outcome: "Sent to review" includes waiting, approved and
// rejected (design.md §6.2a)
const OUTCOMES = [
  { value: ALL, label: "All" },
  { value: "allow", label: "Allowed", icon: CircleCheck },
  { value: "review", label: "Sent to review", icon: CircleAlert },
  { value: "deny", label: "Denied", icon: CircleX },
] as const

type DecisionFiltersProps = {
  agents: Agent[]
  filters: Filters
  onChange: (filters: Filters) => void
}

export function DecisionFilters({
  agents,
  filters,
  onChange,
}: DecisionFiltersProps) {
  const active = filters.outcome !== undefined || filters.agentId !== undefined

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {/* A filter, not tabs: there are no tab panels, just one list (D-018) */}
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        aria-label="Outcome"
        value={filters.outcome ?? ALL}
        onValueChange={(value) => {
          // Radix sends "" when the pressed item is pressed again: keep it
          if (!value) return
          const outcome = outcomeSchema.safeParse(value)
          onChange({
            ...filters,
            outcome: outcome.success ? outcome.data : undefined,
          })
        }}
      >
        {OUTCOMES.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            // Selected: bold text and a brand edge, not background colour alone
            className="data-[state=on]:border-brand data-[state=on]:bg-brand-muted data-[state=on]:font-semibold data-[state=on]:text-foreground"
          >
            {"icon" in option && <option.icon aria-hidden />}
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="flex items-center gap-2">
        <Label htmlFor="decision-filter-agent">Agent</Label>
        <Select
          value={filters.agentId ?? ALL}
          onValueChange={(value) =>
            onChange({ ...filters, agentId: value === ALL ? undefined : value })
          }
        >
          <SelectTrigger id="decision-filter-agent" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All agents</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {active && (
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => onChange({})}
        >
          Clear filters
        </Button>
      )}
    </div>
  )
}
