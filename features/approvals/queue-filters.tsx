import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Agent, Chain } from "@/lib/domain/types"
import { chainName } from "@/lib/format/chain"

export type QueueFilter = { agentId?: string; chain?: Chain }

const ALL = "all"
const CHAINS: Chain[] = ["base", "solana"]

type QueueFiltersProps = {
  agents: Agent[]
  filter: QueueFilter
  onChange: (filter: QueueFilter) => void
  /** Rows shown after filtering. */
  count: number
}

export function QueueFilters({
  agents,
  filter,
  onChange,
  count,
}: QueueFiltersProps) {
  const active = filter.agentId !== undefined || filter.chain !== undefined

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="queue-filter-agent">Agent</Label>
        <Select
          value={filter.agentId ?? ALL}
          onValueChange={(value) =>
            onChange({ ...filter, agentId: value === ALL ? undefined : value })
          }
        >
          <SelectTrigger id="queue-filter-agent" className="w-40">
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

      <div className="flex items-center gap-2">
        <Label htmlFor="queue-filter-chain">Chain</Label>
        <Select
          value={filter.chain ?? ALL}
          onValueChange={(value) =>
            onChange({
              ...filter,
              chain: value === ALL ? undefined : (value as Chain),
            })
          }
        >
          <SelectTrigger id="queue-filter-chain" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All chains</SelectItem>
            {CHAINS.map((chain) => (
              <SelectItem key={chain} value={chain}>
                {chainName(chain)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="ml-auto text-muted-foreground tabular-nums">
        {count} waiting
      </p>
      {active && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
