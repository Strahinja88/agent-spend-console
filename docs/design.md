# Agent Spend Console: design

The visual and interaction contract for every screen in PLAN.md §4. Tokens defined here are the only source of colour: no hex/rgb/oklch values outside `app/globals.css`.

---

## 1. Principles

- **Calm finance tool.** Neutral greys, one accent (indigo), generous whitespace around dense tables.
- **Status is never colour alone.** Every status is shown as icon + label; colour is a third, redundant signal.
- **Money is exact and legible.** Amounts are `bigint` minor units, always rendered with a unit (`120.00 USDC`), right-aligned, `tabular-nums`. See §8.
- **Explain, then prove.** Plain-language sentence first, technical detail (JWT, tx hash, block) second.
- **Every screen has loading, empty and error states.**
- **Keyboard-first, safely.** Everything reachable with Tab. Single-key shortcuts are scoped to the approval queue and can be switched off (§7).

---

## 2. Rule evaluation and display states

### 2.1 Precedence: deny > review > allow

A request is evaluated against the mandate that was active at its `createdAt`:

1. **Hard rules.** If any fails, the outcome is **deny**. Checked in this fixed order, and the first failure gives the reason code:

   | Order | Rule | Fails when | Reason code |
   |---|---|---|---|
   | 1 | `chain` | request chain not in list | `CHAIN_NOT_ALLOWED` |
   | 2 | `vendor_allowlist` | vendor not in list | `VENDOR_NOT_ALLOWED` |
   | 3 | `limit` (tx) | `amount > limit` | `LIMIT_TX_EXCEEDED` |
   | 4 | `limit` (day) | `committed today + amount > limit` | `LIMIT_DAILY_EXCEEDED` |
   | 5 | `limit` (month) | `committed this month + amount > limit` | `LIMIT_MONTHLY_EXCEEDED` |

2. **Review rule.** Only reached if every hard rule passes: `amount > review_threshold` → **review** (`REVIEW_THRESHOLD`).
3. Otherwise → **allow** (`WITHIN_LIMITS`).

So **a request only goes to review if it passes all hard limits.** A reviewer never sees a request that a limit would deny, and approving never breaks a limit.

Definitions:
- **Limits are inclusive** ("up to 500.00 USDC per day" allows exactly 500.00). **The review threshold is strict** ("above 100.00 USDC").
- **Committed spend** for a period = allowed + approved-after-review + waiting-for-review amounts in that period. Denied and rejected requests don't count (a rejected one stops counting from the moment it's rejected). Counting waiting requests reserves their amount, so approving everything in the queue can't exceed the limits the requests were evaluated under (D-006).
- **Approval re-check:** if the agent's mandate has been replaced or revoked since the request, approving re-checks the hard rules against the *current* mandate and warns on any breach (D-007).
- Periods are UTC calendar days and months.

The reason codes are invented (PLAN.md disclaimer). The final list is `reasonCodeSchema` in `lib/domain/schemas.ts`: the five above plus `REVIEW_THRESHOLD` and `WITHIN_LIMITS`.

### 2.2 Display states

The decision `outcome` is what the rules said. The **display state** is what users see in lists and headers, and it includes the result of a review:

| Outcome | Review result | Label | StatusPill status |
|---|---|---|---|
| allow | n/a | Allowed | `allow` ✓ |
| deny | n/a | Denied | `deny` ✕ |
| review | not yet reviewed | Waiting for review | `review` ⚠ |
| review | approved | Approved after review · *reviewer name* | `allow` ✓ |
| review | rejected | Rejected after review | `deny` ✕ |

Rejection details (reviewer and reason) are shown on the decision detail page, not in the pill.

> PLAN §3's `Decision` has `reviewedBy`/`reviewedAt` but no review result or reject reason, so `reviewResult?: 'approved' | 'rejected'` and `reviewReason?: string` were added (D-009). `displayState()` in `lib/domain/display-state.ts` implements this table.

### 2.3 Example mandates (used by every sketch, and by the seed)

| Agent | Mandate | Per payment | Per day | Vendors | Review above | Chains |
|---|---|---|---|---|---|---|
| Research Bot | v1 · M. Ilić, 1 Oct | 200.00 | 500.00 | Weather API, Data Vendor | 100.00 | Base, Solana |
| Ops Agent | v2 · M. Ilić, 12 Oct · **replaced 20 Oct** | 200.00 | 500.00 | Weather API, Cloud GPU | 100.00 | Base, Solana |
| Ops Agent | v3 · J. Perić, 20 Oct · current | 2,000.00 | 3,000.00 | Weather API, Cloud GPU, Data Vendor | 100.00 | Base, Solana |
| Travel Agent | v1 · J. Perić, 1 Oct | 1,500.00 | 3,000.00 | Airline X, Hotel Y | 250.00 | Base |
| Support Bot | v1 · J. Perić, 27 Sep · **replaced 27 Oct 11:00** | 300.00 | 1,000.00 | Helpdesk SaaS, SMS Gateway | 150.00 | Base, Solana |
| Support Bot | v2 · M. Ilić, 27 Oct 11:00 · current | 300.00 | **400.00** | Helpdesk SaaS, SMS Gateway | 150.00 | Base, Solana |
| Marketing Agent | v1 · M. Ilić, 27 Sep | 500.00 | 1,500.00 | Ad Network, Design Studio | 300.00 | Solana |
| Data Pipeline | v1 · J. Perić, 27 Sep | 100.00 | 300.00 (and 1,500.00 per month) | Data Vendor, Cloud GPU | none | Base |

All amounts are in USDC. "Today" in the sketches is 27 Oct. The deployed demo moves these dates with the current day (D-008).

Support Bot has a 250.00 request from v1 still waiting when v2 lowers the daily limit, so the queue shows an approval limit warning for it (D-007). Data Pipeline has the only monthly limit and no review threshold.

### 2.4 Seed rules (binding for phase 2)

- Every seeded decision must be exactly what the evaluator in §2.1 produces for that request, mandate and spend history (outcome **and** reason code).
- Every queue item (waiting for review) passes all hard rules and is above its threshold.
- Phase 2 adds a test that re-runs the evaluator over the whole seed and compares it with the stored decisions.

---

## 3. Tokens

All tokens are CSS custom properties in `app/globals.css`: light values on `:root`, dark values on `.dark` (set by next-themes). Tailwind v4 picks them up via `@theme inline`, so classes read `bg-surface`, `text-muted-foreground`, `border-status-deny-border`, etc.

Values are OKLCH. Contrast targets are WCAG 2.2 AA: **4.5:1** for text, **3:1** for icons, focus rings and control boundaries. Every fg/bg pair below gets checked with a contrast checker when the tokens are added to `globals.css` in the scaffold step; any pair that misses is adjusted there and the value updated here.

> **Naming:** the brand colour is `--brand`, not `--accent`, because shadcn already uses `--accent` for subtle hover backgrounds. See §3.7 and `docs/decisions.md`.

### 3.1 Surfaces and text

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `oklch(0.985 0.002 264)` | `oklch(0.16 0.006 264)` | page |
| `--surface` | `oklch(1 0 0)` | `oklch(0.195 0.007 264)` | cards, table, side panel |
| `--surface-raised` | `oklch(1 0 0)` + shadow | `oklch(0.23 0.008 264)` | dialogs, popovers, toasts |
| `--surface-sunken` | `oklch(0.97 0.003 264)` | `oklch(0.14 0.005 264)` | table header, code blocks, inputs |
| `--border` | `oklch(0.91 0.004 264)` | `oklch(0.30 0.008 264)` | dividers, card edges (decorative) |
| `--border-strong` | `oklch(0.62 0.01 264)` | `oklch(0.50 0.01 264)` | input/checkbox/switch boundaries (≥3:1) |
| `--foreground` | `oklch(0.21 0.01 264)` | `oklch(0.96 0.003 264)` | primary text |
| `--muted-foreground` | `oklch(0.50 0.012 264)` | `oklch(0.72 0.01 264)` | secondary text, column headers |
| `--subtle-foreground` | `oklch(0.55 0.01 264)` | `oklch(0.64 0.01 264)` | timestamps, hints (still ≥4.5:1) |

### 3.2 Brand (indigo)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--brand` | `oklch(0.511 0.262 277)` | `oklch(0.673 0.182 277)` | primary buttons, active nav, links |
| `--brand-foreground` | `oklch(1 0 0)` | `oklch(0.16 0.02 277)` | text on `--brand` |
| `--brand-muted` | `oklch(0.962 0.018 272)` | `oklch(0.28 0.06 277)` | selected table row, active nav bg |
| `--ring` | `oklch(0.585 0.233 277)` | `oklch(0.673 0.182 277)` | focus ring (2px + 2px offset) |

### 3.3 Status

Each status has `-bg`, `-fg` (text + icon) and `-border`.

| Status | Used for | Icon (lucide) | Light bg / fg / border | Dark bg / fg / border |
|---|---|---|---|---|
| `allow` | allowed, approved after review, confirmed, signature valid | `CircleCheck` | `0.962 0.044 157` / `0.448 0.119 151` / `0.871 0.15 154` | `0.27 0.05 155` / `0.871 0.15 154` / `0.42 0.09 152` |
| `review` | waiting for review | `CircleAlert` | `0.962 0.059 96` / `0.473 0.137 46` / `0.879 0.169 92` | `0.28 0.05 70` / `0.879 0.169 92` / `0.45 0.10 70` |
| `deny` | denied, rejected after review, failed, signature invalid | `CircleX` | `0.936 0.032 18` / `0.444 0.177 27` / `0.808 0.114 20` | `0.27 0.06 25` / `0.808 0.114 20` / `0.45 0.13 25` |
| `pending` | payment pending, submitted, not reached | `CircleDashed` | `0.955 0.004 264` / `0.42 0.012 264` / `0.86 0.006 264` | `0.26 0.008 264` / `0.82 0.008 264` / `0.40 0.01 264` |

(All values `oklch(L C H)`.) Pending is neutral grey on purpose, so it can't be confused with the indigo brand.

`--destructive` (Reject button): light `oklch(0.577 0.245 27)` with white text, dark `oklch(0.55 0.2 27)` with white text.

### 3.4 Typography

- **Geist Sans** for UI, **Geist Mono** for addresses, hashes and JWTs, both via `next/font` (no extra dependency).
- Amounts: Geist Sans with `tabular-nums`, never mono.

| Token | Size / line-height | Use |
|---|---|---|
| `text-xs` | 12 / 16 | badges, meta, kbd |
| `text-sm` | **13** / 20 | **table body**, side panel body |
| `text-base` | **14** / 22 | default UI text |
| `text-md` | 16 / 24 | section titles |
| `text-lg` | 20 / 28 | page titles |
| `text-xl` | 24 / 32 | header amount on decision detail |

`text-sm` and `text-base` are deliberately one step smaller than Tailwind's defaults (14/16), and `text-md` is a new step. This affects every shadcn component. See `docs/decisions.md` (D-001).

Weights: 400 body, 500 labels and table headers, 600 titles and amounts in headers.

### 3.5 Space, radius, elevation

- Spacing is on a 4px base (Tailwind default scale). Table rows are 36px high (dense) with 12px horizontal cell padding. Cards use 16–24px padding, pages 24px (desktop) and 16px (mobile) gutters.
- Radius: `--radius-sm` 4px (pills, kbd), `--radius-md` 6px (buttons, inputs), `--radius-lg` 8px (cards, panels, dialogs, toasts).
- Shadows: `--shadow-panel` (side panel, sticky header) and `--shadow-dialog` (dialogs, popovers, toasts). Dark mode leans on `--surface-raised` + border instead of shadow.

### 3.6 Motion

- `--duration-fast` 150ms (hover, pill changes), `--duration-base` 200ms (side panel slide, dialog fade, toast in/out), easing `cubic-bezier(0.2, 0, 0, 1)`.
- Under `prefers-reduced-motion: reduce`, durations go to 0ms and the side panel appears without sliding.
- No motion conveys information on its own.

### 3.7 Mapping to shadcn variables

shadcn components read their own variable names; `globals.css` aliases them to ours:

| shadcn | → ours |
|---|---|
| `--primary` / `--primary-foreground` | `--brand` / `--brand-foreground` |
| `--secondary`, `--muted` | `--surface-sunken` |
| `--muted-foreground` | `--muted-foreground` |
| `--accent` / `--accent-foreground` | `--surface-sunken` / `--foreground` (hover bg) |
| `--card`, `--popover` | `--surface`, `--surface-raised` |
| `--input` | `--border-strong` |
| `--destructive` | `--destructive` |
| `--ring`, `--border`, `--background`, `--foreground` | same name |

---

## 4. Components

`components/data/` holds generic display components with no domain fetching. `features/*` holds screen-specific compositions.

| Component | Location | Props (sketch) | Notes |
|---|---|---|---|
| **StatusPill** | data | `status: 'allow'\|'review'\|'deny'\|'pending'`, `label: string` | Icon + label always. The label comes from the display state (§2.2), e.g. "Approved after review · M. Ilić". Icon is `aria-hidden`; the label carries the meaning. |
| **Amount** | data | `value: bigint`, `decimals = 6`, `unit = 'USDC'`, `size?` | Uses `formatAmount` (§8): bigint `/` and `%` to a decimal string, never `Number`. Output: `1,250.00 USDC`. `tabular-nums`, right-aligned in tables. |
| **Address** | data | `value: string`, `chain`, `label?: string`, `explorerHref?` | Mono, middle-truncated (`0x036C…CF7e`, `4zMM…ncDU`). Shows the known label first ("Weather API") with the address beneath. Copy button (`aria-label="Copy address"`, "Copied" announced via `aria-live`). Full value in a tooltip and `title`. |
| **RelativeTime** | data | `iso: string` | "3 min ago" in a `<time dateTime>`. Tooltip shows absolute UTC + local. Re-renders every 60s. |
| **DataTable** | data | TanStack `table`, `onRowSelect?`, `selectedId?`, `loading`, `empty`, `error` | Semantic `<table>`, `<th scope="col">`, `aria-sort` on sortable headers. Sticky header. Selected row shown with `--brand-muted` bg + left 2px brand bar + `aria-selected` (not colour alone). Built-in skeleton rows, empty and error slots. |
| **SidePanel** | data | `open`, `onClose`, `title`, `children`, `footer` | Right-hand panel on desktop (≈420px, the table stays visible), full-screen sheet below `md`. Non-modal on desktop (it sits inside the queue region, so shortcuts keep working), modal sheet on mobile. `Esc` closes and focus returns to the row. |
| **Timeline / TimelineStep** | data | steps: `{ key, title, status, time?, children }[]` | `<ol>` with a vertical connector. Each step has a status icon + text ("Done", "In progress", "Failed", "Not reached"). |
| **RuleSentence** | data | `rule: Rule`, `matched?: boolean` | Renders a rule as one sentence ("Payments above 100.00 USDC need review."). The text comes from `lib/domain` (phase 2); this only presents it, with the key number emphasised and a "Matched rule" label when `matched`. |
| **SpendBar** | data | `committed: bigint`, `limit: bigint`, `period` | Meter with the text always visible ("1,730.00 of 3,000.00 USDC committed today"); the bar is supplementary. `role="meter"` with `aria-valuetext`. |
| **VerdictPanel** | features/decisions | `jwt: string` (keys from `GET /api/jwks`) | Decoded header + payload in code blocks, **Verify signature** button, **Tamper** switch, result shown StatusPill-style as "Signature valid" / "Signature invalid" + reason. Result announced via `aria-live="polite"`. |
| **ApprovalUndoToast** | features/approvals | `request`, `onUndo`, `onCommit` | "Approved · *amount* to *vendor*" + **Undo**. Calls `onCommit` when the toast auto-closes. See §6.1. |
| **EmptyState** | data | `icon`, `title`, `description`, `action?` | e.g. "Nothing waiting for approval" with a "View recent decisions" action. |
| **ErrorState** | data | `title`, `description?`, `onRetry` | "Couldn't load approvals" with a **Retry** button. Never shows a raw error. |
| **KeyboardHelp** | features/approvals | `shortcuts`, `enabled`, `onEnabledChange` | Dialog listing shortcuts, plus the **Keyboard shortcuts** on/off switch (§7). Opened from a visible button or `?`. |
| **AppShell** | components | `children` | Skip link, sidebar `<nav aria-label="Main">`, top bar with page title + ThemeToggle, `<main id="content">`. |
| **ThemeToggle** | components | none | Icon button, `aria-label="Switch to dark theme"`/"light". Light / Dark / System. |

shadcn primitives used underneath: Button, Tooltip, Sheet, Dialog, AlertDialog, DropdownMenu, Select, Switch, Textarea, Skeleton, Separator, Badge, Sonner (toast; added in phase 3 after approval as a dependency).

---

## 5. State patterns (every screen)

| State | Pattern |
|---|---|
| Loading | Skeletons in the shape of the final content (table: 8 skeleton rows at real row height; cards: title + 3 lines). No spinners for page loads. Spinner only inside a button during a mutation. |
| Empty | `EmptyState` with a next action. Filters active → "No results for these filters" + **Clear filters**. |
| Error | `ErrorState` with **Retry**. Mutation errors → toast + rollback (approvals), inline error text near the control otherwise. |
| Background refresh | Previous data stays visible. A subtle "Updated 10s ago" in the page header, no layout shift. |

---

## 6. Layouts

All sketches are desktop (≥1280px) and use the mandates in §2.3. Mobile notes follow each one.

### 6.0 App shell

```
┌──────────────┬───────────────────────────────────────────────────────────────────┐
│ ◆ Spend      │  Approvals                                          [☾ Theme]     │
│   Console    ├───────────────────────────────────────────────────────────────────┤
│              │                                                                   │
│ ▸ Approvals 12                                                                   │
│   Decisions  │                       <page content>                              │
│              │                                                                   │
│              │                                                                   │
│              │                                                                   │
│ ──────────── │                                                                   │
│ Demo · test- │                                                                   │
│ net only     │                                                                   │
└──────────────┴───────────────────────────────────────────────────────────────────┘
  220px sidebar; active item = brand-muted bg + brand text + bold (not colour alone)
```

The number next to **Approvals** is how many requests are waiting. The link's accessible name is "Approvals, 12 waiting" (the visible number is `aria-hidden`). It shares the queue's query and updates optimistically on approve/reject, and it's hidden while loading, after an error, or at 0 (D-014).

There's no Payments item: PLAN.md has no payments list, only `/payments/[id]`, which is reached from a decision.

Mobile (<768px): the sidebar collapses into a ☰ button in the top bar that opens a Sheet.

### 6.1 Approval queue: `/approvals`

Every row below passes all hard rules for its agent and is above that agent's review threshold.

```
┌─ Approvals ───────────────────────────────────── Updated 4s ago  [⌨ Shortcuts] ──┐
│ Agent [All agents ▾]  Chain [All ▾]                       12 waiting  [Clear]   │
├─ section "Approval queue" (shortcut scope) ─────────────────────────────────────┤
│ Agent ↕        Vendor        Amount ↕  Chain  Age ↕  │ ✕  Review request         │
│                                                      │                           │
│ Research Bot   Weather API  120.00 USDC Base  3 min  │ Ops Agent → Cloud GPU     │
│▌Ops Agent      Cloud GPU  1,250.00 USDC Sol   8 min  │ 1,250.00 USDC · Solana    │
│ Ops Agent      Data Vendor  180.00 USDC Base 12 min  │ Requested 8 min ago       │
│ Travel Agent   Airline X    640.00 USDC Base 25 min  │ Memo: "GPU hours, batch 7"│
│ …                                                    │                           │
│                                                      │ Why it needs review       │
│  Rule column: "Above 100.00 USDC review threshold"   │ ⚠ Above the 100.00 USDC   │
│  (the only possible trigger, see §2.1)               │   review threshold.       │
│                                                      │ ✓ Within all limits.      │
│                                                      │                           │
│                                                      │ Committed today           │
│                                                      │ ██████░░░░ 1,730.00 of    │
│                                                      │ 3,000.00 USDC (incl. this)│
│                                                      │                           │
│                                                      │ Mandate v3 · approved by  │
│                                                      │ J. Perić, 20 Oct          │
│                                                      ├───────────────────────────┤
│                                                      │ [Reject  r] [Approve  a]  │
└──────────────────────────────────────────────────────┴───────────────────────────┘
 ▌ = selected row (brand-muted bg + left bar + aria-selected)
```

The numbers fit the mandate: Ops Agent v3 had 300.00 USDC allowed earlier today. The 180.00 request (12 min ago) took committed spend to 480.00, and this 1,250.00 request takes it to 1,730.00, within both the 2,000.00 per-payment and 3,000.00 daily limits.

Columns: Agent · Vendor · Amount (right) · Chain · Age · Trigger rule. Sortable: agent, amount, age (default: age, newest first). Filters: agent, chain.

**Approve, up to and including 1,000.00 USDC:** no dialog. The row leaves the queue at once, the selection moves to the next row, and a toast appears:

```
                              ┌──────────────────────────────────────────────┐
                              │ ✓ Approved · 120.00 USDC to Weather API      │
                              │                                   [Undo]     │
                              └──────────────────────────────────────────────┘
```

- The toast stays for **5 s**. **The approve mutation is sent only when the toast closes on its own.** It's triggered from the toast's auto-close callback, not a separate timer, so pausing the toast (hover or keyboard focus, Sonner's default) also delays the send.
- **Undo** cancels the send; the row returns to its sorted position and is reselected. Nothing reached the API. Undo is the only way to cancel: swiping the toast away also sends (D-012).
- If the mutation then fails: the row is restored and an error toast says "Couldn't approve 120.00 USDC to Weather API" with **Retry**.
- Several approvals can be pending at once (one toast each). Rows with a pending approval stay hidden even if a poll returns them.
- Navigating to another page inside the app sends pending approvals immediately. Closing the tab doesn't send them, so the request stays waiting (fails safe).
- The toast region is `aria-live="polite"`, and Undo is a real button reachable with Tab.

**Approve, above 1,000.00 USDC:** AlertDialog. On confirm the mutation is sent immediately (no undo toast), with optimistic removal and rollback on failure. The dialog opens with focus on **Cancel**, so an accidental Enter never approves.

**Approve with a limit warning** (any amount, D-007): the panel shows the breaches in a "Limit warning" note, and approving always opens the same AlertDialog with the breaches listed and **Approve anyway** (Cancel focused), which sends `acknowledgeLimitWarning: true`. No undo toast (D-013).

```
┌─ Approve 1,250.00 USDC? ───────────────────────┐
│ Ops Agent → Cloud GPU on Solana.               │
│ This is above 1,000.00 USDC.                   │
│                         [Cancel] [Approve]     │
└────────────────────────────────────────────────┘
```

**Reject** expands an inline required textarea in the panel footer ("Reason for rejecting") with **Confirm reject** disabled until it's filled. It's sent immediately on confirm (optimistic, with rollback).

**Keyboard help** (`?` or the **⌨ Shortcuts** button):

```
┌─ Keyboard shortcuts ──────────────────────────────┐
│ Keyboard shortcuts                    [ ●━━ On ]  │
│ Single-key shortcuts work only while focus is in  │
│ the approval queue.                               │
│ ───────────────────────────────────────────────── │
│ j / k   Next / previous request                   │
│ a       Approve                                   │
│ r       Reject                                    │
│ ?       Show this help                            │
│ Esc     Close panel / dialog                      │
└───────────────────────────────────────────────────┘
```

When the switch is off, the shortcut list in this dialog is dimmed (muted text colour, not opacity, so it stays AA) with "Shortcuts are off".

States: skeleton table (panel hidden); EmptyState "Nothing waiting for approval" (action: "View recent decisions"); ErrorState with Retry. New items from polling are announced as "2 new requests waiting" (`aria-live="polite"`) and get a "New" badge, without stealing focus or moving the selection.

Mobile: the table drops the Chain and Rule columns (chain shown under vendor). Tapping a row opens the panel as a full-screen sheet with the actions pinned to the bottom.

### 6.2a Decisions list: `/decisions`

```
┌─ Decisions ──────────────────────────────────────────────────────────────────────┐
│ [ All | ✓ Allowed | ⚠ Sent to review | ✕ Denied ]   Agent [All ▾]                │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Status                            Agent         Vendor       Amount        When  │
│ ⚠ Waiting for review              Ops Agent     Cloud GPU  1,250.00 USDC   8m    │
│ ✓ Allowed                         Research Bot  Weather API    80.00 USDC  1h    │
│ ✓ Approved after review · M. Ilić Travel Agent  Hotel Y       420.00 USDC  2h    │
│ ✕ Rejected after review           Ops Agent     Cloud GPU     900.00 USDC  5h    │
│ ✕ Denied                          Research Bot  Weather API   250.00 USDC  1d    │
│ …                                                                     ‹ 1 2 3 ›  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- Status shows the display state (§2.2). The reason code moves to a secondary line on hover/detail, so the column isn't too wide.
- The filter tabs use the rule outcome. "Sent to review" includes waiting, approved and rejected.
- Consistency: 250.00 to Weather API for Research Bot is above its 200.00 per-payment limit, so it's denied (`LIMIT_TX_EXCEEDED`), even though it's also above the review threshold.
- Each row links to `/decisions/[id]` (the whole row is a link target; the agent name cell holds the real `<a>`).

Mobile: Status, Vendor and Amount, with agent + time as a second line.

### 6.2b Decision detail: `/decisions/[id]`

Example: a deny under Ops Agent's **v2** mandate, on 18 Oct (before v3 replaced it).

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ‹ Decisions                                                                      │
│ ✕ Denied    120.00 USDC                                                          │
│ Ops Agent → Cloud GPU · Base · 18 Oct, 14:02                [View payment ›]     │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Explanation                                                                      │
│ Denied: the daily limit is 500.00 USDC, 430.00 USDC was already committed that   │
│ day and this request is 120.00 USDC.                                             │
│ It's also above the 100.00 USDC review threshold, but a hard limit failed, so it │
│ was denied rather than sent to review.                                           │
│ Code: LIMIT_DAILY_EXCEEDED                                                       │
├──────────────────────────────────────┬───────────────────────────────────────────┤
│ Mandate v2                           │ Signed verdict                            │
│ ⓘ Replaced by v3 on 20 Oct           │ Header                                    │
│ Approved by M. Ilić · 12 Oct         │ ┌───────────────────────────────────────┐ │
│                                      │ │ { "alg": "ES256", "kid": "Xy3k…9QaB" }│ │
│ • Up to 200.00 USDC per payment.     │ └───────────────────────────────────────┘ │
│ ▸ Up to 500.00 USDC per day.         │ Payload                                   │
│   Matched rule                       │ ┌───────────────────────────────────────┐ │
│ • Only Weather API and Cloud GPU.    │ │ { "decisionId": "dec_…",              │ │
│ • Payments above 100.00 USDC need    │ │   "outcome": "deny",                  │ │
│   review.                            │ │   "amount": "120000000", … }          │ │
│ • Base and Solana only.              │ └───────────────────────────────────────┘ │
│                                      │ [Verify signature]   ◯ Tamper with payload│
│                                      │                                           │
│                                      │ ✓ Signature valid · key Xy3k…9QaB · ES256 │
└──────────────────────────────────────┴───────────────────────────────────────────┘
```

The matched rule is marked with ▸, bold text and a "Matched rule" label.

**Review outcomes**: the header pill and explanation show the final state:

```
│ ✓ Approved after review · M. Ilić    420.00 USDC                                 │
│ Travel Agent → Hotel Y · Base · 27 Oct, 12:10 (2 h ago)                          │
│ Explanation                                                                      │
│ Sent to review: 420.00 USDC is above the 250.00 USDC review threshold and within │
│ all limits. Approved by M. Ilić at 12:14.                                        │
```

```
│ ✕ Rejected after review    900.00 USDC                                           │
│ … Rejected by J. Perić at 09:31: "Duplicate of yesterday's GPU order."           │
```

```
│ ⚠ Waiting for review    1,250.00 USDC                [Review in queue ›]         │
```

**Tamper** on: the payload block highlights the changed field (`"outcome": "allow"` with a "changed, was "deny"" tag) and the result is reset. Verify then shows `✕ Signature invalid: payload does not match signature`. Allowed decisions flip to `"deny"` instead (D-017).

**Keys:** the panel verifies in the browser with jose against the JWKS from `GET /api/jwks` (`createLocalJWKSet`). The `kid` is the key's RFC 7638 thumbprint, shown middle-truncated with the full value in `title`. A verdict whose `kid` isn't in the JWKS (e.g. signed on an earlier page load) shows `✕ Signature invalid: unknown key. It was signed with a key that isn't in the current key set…` rather than a signature error (D-015).

**Mandate note:** `GET /api/decisions/:id` returns `replacedBy` (the superseding mandate) so the card can say "Replaced by v3 on 20 Oct"; a mandate revoked without a replacement says "Revoked on …".

States: skeleton header + cards; "Decision not found" EmptyState linking back to the list; ErrorState with Retry.

Mobile: single column (explanation → mandate → verdict), with code blocks scrolling horizontally inside their box.

### 6.3 Payment timeline: `/payments/[id]`

Example: Research Bot paid 120.00 USDC to Weather API on 26 Oct. It was above the 100.00 threshold, within the 200.00 / 500.00 limits, and approved after review.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ‹ Decision dec_8f2…                                                              │
│ Payment pay_41c…    ✓ Confirmed                                                  │
│ Confirmed on Base Sepolia · 120.00 USDC sent to Weather API · 1 day ago          │
├──────────────────────────────────────────────────────────────────────────────────┤
│  ✓  Requested          Research Bot asked to pay Weather API     26 Oct 13:58    │
│  │                                                                               │
│  ✓  Decision           ⚠ Sent to review: above the 100.00 USDC      13:58        │
│  │                     review threshold. View decision ›                         │
│  ✓  Approved           after review by M. Ilić                      14:01        │
│  │                                                                               │
│  ✓  Submitted          tx 0x9a1c…77e0 [⧉]                           14:01        │
│  │                                                                               │
│  ✓  Confirmed onchain  ┌──────────────────────────────────────────────────────┐  │
│                        │ Amount     120.00 USDC                               │  │
│                        │ From       Research Bot  0x52a8…1f3c [⧉]             │  │
│                        │ To         Weather API   0x9f0e…a2b4 [⧉]             │  │
│                        │ Block      18,402,113 · 42 confirmations             │  │
│                        │ Network    Base Sepolia (testnet)                    │  │
│                        │                         View on block explorer ↗     │  │
│                        └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Block, hash and addresses here are placeholders. Phase 5 replaces them with the real testnet transactions. In the seed only three small payments (2.50, 3.00 and 4.00 USDC, see `mocks/seed/tx-slots.ts`) get a real transaction. All other payments, including this 120.00, are `simulated` and show "Simulated payment, no onchain transaction" instead of the onchain card (D-009).

Solana variant: "Slot 312,550,904 · Finalized" instead of block/confirmations; addresses are base58.

States:
- **Pending** (submitted, not confirmed): the last step shows `◌ Waiting for confirmation` and the step stays "In progress".
- **Failed**: `✕ Failed onchain` with the reason if the RPC returns one, plus an explorer link.
- **Not found**: `◌ Transaction not found on Base Sepolia` with a note that testnet RPCs can lag, plus **Retry**.
- **Not yet submitted** (waiting for review / rejected after review): later steps are "Not reached", greyed, with text.
- Loading: timeline skeleton with 5 steps.

Mobile: works as-is (single column), but the address label wraps above the address.

### 6.4 Stretch: policy diff: `/agents/[id]/policy`

Ops Agent v2 → v3 (§2.3):

```
┌─ Ops Agent · Policy ─────────────────────────────────────────────────────────────┐
│  v2 (previous) · approved by M. Ilić 12 Oct   │  v3 (current) · approved by       │
│  Replaced 20 Oct                              │  J. Perić 20 Oct                  │
├───────────────────────────────────────────────┼───────────────────────────────────┤
│  ~ Up to 200.00 USDC per payment.  [Changed]  │  ~ Up to 2,000.00 USDC per payment│
│  ~ Up to 500.00 USDC per day.      [Changed]  │  ~ Up to 3,000.00 USDC per day.   │
│  ~ Only Weather API and Cloud GPU. [Changed]  │  ~ Only Weather API, Cloud GPU    │
│                                               │    and Data Vendor.               │
│  = Payments above 100.00 USDC need review.    │  = Payments above 100.00 USDC     │
│                                               │    need review.                   │
│  = Base and Solana only.                      │  = Base and Solana only.          │
└───────────────────────────────────────────────┴───────────────────────────────────┘
```

Markers: `+` Added, `−` Removed, `~` Changed, `=` Unchanged. Each is an icon + a text tag; colour is only supplementary.

---

## 7. Keyboard and focus

### 7.1 Shortcuts

| Key | Active when | Action |
|---|---|---|
| `j` / `k` | focus is inside the approval queue region | move the selection down/up; opens the panel for the selected row |
| `a` | in the region, a row is selected | approve (≤ 1,000.00 USDC → undo toast; above → confirm dialog) |
| `r` | in the region, a row is selected | open the reject reason field, focused |
| `?` | in the region | open keyboard help |
| `Esc` | anywhere (not a character key) | close dialog → close panel → clear selection, in that order |

### 7.2 WCAG 2.1.4 (Character Key Shortcuts)

Both of the allowed mechanisms are provided:

1. **Active only on focus.** The queue table and side panel are wrapped in `<section aria-label="Approval queue">`. The key handler is attached to that section (`onKeyDown`), not to `document`, so `a`/`r`/`j`/`k`/`?` do nothing anywhere else on the page or site.
2. **Can be turned off.** The help dialog has a **Keyboard shortcuts** switch (shadcn Switch, labelled, default **on**).
   - It's persisted in `localStorage` under `asc:shortcuts-enabled` (`"true"`/`"false"`).
   - Every read and write is wrapped in `try/catch`. If storage is unavailable, the setting falls back to in-memory for the session (default on).
   - It's read after mount, so server render and first client render match.
   - When off, all single-key shortcuts are disabled, including `?`. Help stays reachable through the visible **⌨ Shortcuts** button.

Also ignored when: a modifier is held (Ctrl/Alt/Meta), focus is in an input, textarea, select or contenteditable, or a dialog is open (the dialog handles its own keys).

### 7.3 Focus

- The selected row scrolls into view and has a visible focus ring. When the panel closes, focus returns to that row.
- After approve (or undo) or reject, the selection moves to the next row (or the EmptyState). Undo restores the selection to the undone row.
- The focus ring is a 2px `--ring` outline with a 2px offset on every interactive element. It is never removed.

---

## 8. Formatting rules

### 8.1 Amounts: bigint only

Money is never converted to `Number`, `parseFloat` or divided by `1e6`. The bigint is split into whole and fractional parts with bigint `/` and `%`, turned into a decimal string, and only then formatted:

```ts
// lib/format/amount.ts (phase 2)
function splitAmount(value: bigint, decimals: number) {
  const sign = value < 0n ? '-' : ''
  const abs = value < 0n ? -value : value
  const base = 10n ** BigInt(decimals)
  const whole = abs / base                       // bigint division truncates
  const fraction = (abs % base)
    .toString()
    .padStart(decimals, '0')                     // 1n with 6 decimals → "000001"
    .replace(/0+$/, '')                          // trim trailing zeros…
    .padEnd(2, '0')                              // …but keep at least 2
  return { sign, whole, fraction }
}

export function toDecimalString(value: bigint, decimals: number): string {
  const { sign, whole, fraction } = splitAmount(value, decimals)
  return `${sign}${whole}.${fraction}`
}

const grouping = new Intl.NumberFormat('en-US')  // format() accepts bigint exactly

export function formatAmount(value: bigint, decimals = 6, unit = 'USDC'): string {
  const { sign, whole, fraction } = splitAmount(value, decimals)
  return `${sign}${grouping.format(whole)}.${fraction} ${unit}`
}
```

Phase 2 unit tests: `0n` → `0.00 USDC`, `1n` → `0.000001 USDC`, `120_000_000n` → `120.00 USDC`, `1_250_500_000n` → `1,250.50 USDC`, `10n ** 24n` (exact grouping, no precision loss), negative values.

### 8.2 Other formats

| Thing | Rule | Example |
|---|---|---|
| Relative time | < 1 min "just now", then min / h / days; > 7 days → date | `3 min ago`, `2 days ago`, `18 Oct` |
| Absolute time | tooltip: UTC + local | `2026-10-27 13:02 UTC · 14:02 CET` |
| EVM address/hash | `0x` + 4 … 4 | `0x036C…CF7e` |
| Solana address/sig | 4 … 4 | `4zMM…ncDU` |
| Chain names | Base Sepolia / Solana Devnet in full; "Base" / "Solana" in table cells | |
