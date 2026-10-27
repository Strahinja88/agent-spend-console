// Which queue shortcut a keydown means, if any (design.md §7). Pure, so the
// rules are easy to test without rendering the queue.

export type QueueAction =
  "next" | "previous" | "approve" | "reject" | "help" | "escape"

const CHARACTER_KEYS: Record<string, QueueAction> = {
  j: "next",
  k: "previous",
  a: "approve",
  r: "reject",
  "?": "help",
}

type KeyInput = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "altKey" | "metaKey" | "target"
>

function isTyping(target: Element): boolean {
  return (
    target.matches("input, textarea, select, [contenteditable='true']") ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

/**
 * `enabled` is the Keyboard shortcuts switch. When it is off, every
 * single-character shortcut (including `?`) is ignored; Esc still works,
 * because it isn't a character key (WCAG 2.1.4).
 */
export function shortcutFor(
  event: KeyInput,
  enabled: boolean,
): QueueAction | null {
  if (event.ctrlKey || event.altKey || event.metaKey) return null

  const target = event.target instanceof Element ? event.target : null
  // Dialogs handle their own keys (React events bubble out of portals)
  if (target?.closest("[role='dialog'], [role='alertdialog']")) return null

  if (event.key === "Escape") return "escape"
  if (!enabled || (target && isTyping(target))) return null

  return CHARACTER_KEYS[event.key] ?? null
}
