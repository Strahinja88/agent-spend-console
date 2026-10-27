// Relative time for tables, absolute UTC + local for tooltips (docs/design.md §8.2).

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})
const shortDateWithYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

/** "just now", "3 min ago", "2 h ago", "2 days ago", then "18 Oct" after a week. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const diff = now.getTime() - then.getTime()

  // Small clock skew between mock and browser shouldn't read "in 2 seconds"
  if (diff < MINUTE) return "just now"
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`
  if (diff < 7 * DAY) {
    const days = Math.floor(diff / DAY)
    return days === 1 ? "1 day ago" : `${days} days ago`
  }
  return then.getUTCFullYear() === now.getUTCFullYear()
    ? shortDate.format(then)
    : shortDateWithYear.format(then)
}

/** "2026-10-27 13:02 UTC · 14:02 CET", with the local date added when it differs. */
export function formatAbsolute(iso: string, timeZone?: string): string {
  const date = new Date(iso)
  const utc = `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`

  const local = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    local.find((p) => p.type === type)?.value ?? ""

  const localDate = `${part("year")}-${part("month")}-${part("day")}`
  const localTime = `${part("hour")}:${part("minute")} ${part("timeZoneName")}`
  const sameDay = localDate === date.toISOString().slice(0, 10)

  return `${utc} · ${sameDay ? localTime : `${localDate} ${localTime}`}`
}
