# Agent Spend Console: demo plan (short version)

A focused portfolio demo of a finance console for AI-agent payments: an **approval queue**, a **decision detail page with signed-verdict verification**, and a **payment timeline that tracks real USDC testnet transactions** on Base and Solana.

Target: **1–2 days**, small enough to understand and explain line by line.

> **Not affiliated with any company.** Own name, own colours. Concepts (mandates, signed verdicts, review thresholds) are modelled generically; decision codes are invented.

---

## 1. Goals

- Production-quality React + TypeScript screens for data-heavy, decision-heavy finance UI.
- Show that a payment decision can be explained in plain language and verified cryptographically.
- Show basic, real onchain integration (read-only) with viem and Solana web3.js.

Non-goals: real backend, auth, real money, wallet connection, signing transactions, smart contracts.

---

## 2. Tech stack

| Area | Choice |
|---|---|
| Framework | **Next.js 15 (App Router)**, **React 19**, **TypeScript (strict)** |
| Server state | **TanStack Query v5** |
| Tables | **TanStack Table v8** |
| UI | **Tailwind CSS v4** + **shadcn/ui** (Radix primitives) |
| Theme | **next-themes** (dark mode, no-flash, system preference; see D-003) |
| Toasts | **sonner** (shadcn's toast; undo toast in the approval queue; see D-003) |
| Validation | **Zod** |
| Mock API | **MSW** with seeded data, ~300–800 ms latency, ~10% simulated failures on mutations |
| Signed verdicts | **jose** (ES256 JWT sign + verify, JWKS) |
| EVM | **viem** on **Base Sepolia** |
| Solana | **@solana/web3.js** on **devnet** |
| Money | `bigint` minor units (USDC = 6 decimals), formatted with `Intl.NumberFormat` |
| Testing | **Vitest** + **Testing Library**, **axe-core**; one **Playwright** flow if time allows |
| Tooling | pnpm, ESLint, Prettier, GitHub Actions (lint + typecheck + test) |
| Deploy | Vercel |

Testnet constants (verify against Circle's docs before use):
- USDC on Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- USDC on Solana devnet (mint): `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

**Security:** read-only onchain. No private keys, no wallet connection, no signing transactions, no mainnet. RPC URLs in `.env.local`; never commit secrets.

---

## 3. Domain model (mock)

```ts
type Agent = { id: string; name: string; owner: string }

// Mandates are immutable: revoked and replaced, never edited.
type Mandate = {
  id: string; agentId: string; version: number;
  rules: Rule[]; approvedBy: string; approvedAt: string;
  revokedAt?: string; supersededBy?: string;
}

type Rule =
  | { kind: 'limit'; amount: bigint; period: 'tx' | 'day' | 'month' }
  | { kind: 'vendor_allowlist'; vendors: string[] }
  | { kind: 'review_threshold'; amount: bigint }
  | { kind: 'chain'; chains: ('base' | 'solana')[] }

type PaymentRequest = {
  id: string; agentId: string; vendor: string;
  amount: bigint; chain: 'base' | 'solana'; createdAt: string; memo?: string;
}

type Decision = {
  id: string; requestId: string; mandateId: string; mandateVersion: number;
  outcome: 'allow' | 'deny' | 'review';
  reasonCode: string;   // invented, e.g. LIMIT_DAILY_EXCEEDED
  reason: string;       // plain language
  matchedRule?: Rule;
  verdictJwt: string;   // ES256-signed
  decidedAt: string; reviewedBy?: string; reviewedAt?: string;
}

type Payment = {
  id: string; decisionId: string; chain: 'base' | 'solana'; txHash?: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'submitted' | 'confirmed' | 'failed';
}
```

Seed: 6 agents, ~200 requests over 30 days, ~12 items waiting for review, 2 mandate versions for one agent, and **2–3 real testnet tx hashes** (at least one per chain) attached to confirmed payments.

---

## 4. Screens

### 4.1 Approval queue (`/approvals`): main screen
- Dense TanStack table: agent, vendor, amount, chain, age, rule that triggered review. Sortable, filterable by agent and chain.
- Selecting a row opens a side panel with the request, the triggering rule **in plain language** ("Above the 100 USDC review threshold"), the agent's spend today vs limit, and the mandate version.
- Approve / Reject. Reject requires a reason. Confirm dialog for amounts above 1,000 USDC.
- Optimistic update with rollback and error toast when MSW fails the request.
- Keyboard: `j`/`k` move, `a` approve, `r` reject, `Esc` close, `?` shortcut help.
- Polls every 10 s; new items announced via `aria-live`.
- Empty state ("Nothing waiting for approval") and error state with retry.

### 4.2 Decision detail (`/decisions/[id]`)
- Header: outcome pill, amount, agent, vendor, time.
- **Explanation in plain language**, e.g. "Denied: the daily limit is 500 USDC, 430 USDC was already spent today and this request is 120 USDC."
- Mandate that applied: version number, rules rendered as sentences, note if it has since been replaced.
- **Verdict panel:** decoded JWT header and payload; **Verify signature** button using `jose` against a local JWKS. Shows valid or invalid. A **Tamper** toggle changes one payload field to show verification failing.
- Link to the payment timeline.
- A simple decisions list at `/decisions` (table with outcome filter) to reach detail pages.

### 4.3 Payment timeline (`/payments/[id]`)
- Vertical timeline: Requested, Decision, Approved (by whom), Submitted, Confirmed onchain.
- Onchain step from **real testnet data**:
  - Base: viem `getTransactionReceipt` + decode USDC `Transfer` log (amount, from, to), block number, confirmations.
  - Solana: `getParsedTransaction` on devnet, token transfer amount, slot, status.
- Plain language: "Confirmed on Base Sepolia · 120.00 USDC sent to Weather API · 3 min ago."
- Addresses truncated in the middle, monospace, copy button, agent/vendor label where known.
- Block explorer link as a secondary action.
- States for pending, failed and "transaction not found".

### 4.4 Stretch (only if time allows): policy diff
- `/agents/[id]/policy`: current and previous mandate versions as sentences, with a diff (added / removed / changed, each marked by icon + text, not colour alone) and who approved each version. Read-only.

---

## 5. Design direction

- Calm, trustworthy finance tool: neutral greys, one accent colour, generous spacing around dense tables.
- Inter or Geist; `tabular-nums` for amounts; amounts right-aligned, always with unit (`120.00 USDC`).
- Status: allow = green, review = amber, deny = red, pending = grey/blue. **Always icon + label, never colour alone.**
- Time: relative ("3 min ago"), absolute UTC + local in tooltip.
- Loading skeletons, empty states with a next action, error states with retry, on every screen.
- Dark mode with CSS variables; tokens in one file.
- Accessibility: WCAG 2.2 AA contrast, full keyboard use, visible focus, semantic tables, labelled icon buttons, `prefers-reduced-motion`.
- Desktop-first; queue and decision detail usable on mobile.

Before coding, write `docs/design.md`: tokens, component list (StatusPill, Amount, Address, DataTable, SidePanel, Timeline, RuleSentence, VerdictPanel), and an ASCII layout sketch per screen.

---

## 6. Structure

```
app/
  layout.tsx                 # shell, sidebar, theme
  approvals/page.tsx
  decisions/page.tsx
  decisions/[id]/page.tsx
  payments/[id]/page.tsx
components/ui/               # shadcn
components/data/             # StatusPill, Amount, Address, DataTable, Timeline, RuleSentence
features/approvals/ decisions/ payments/
lib/api/                     # typed fetchers, query key factory, hooks
lib/chain/                   # viem + solana clients, USDC decoding
lib/verdict/                 # jose sign/verify, JWKS
lib/format/                  # bigint money, dates, addresses
lib/domain/                  # types, zod schemas, rule → sentence
mocks/                       # MSW handlers + seed
docs/design.md  docs/decisions.md
```

---

## 7. Phases (one Claude session each; review and commit after each)

1. **Design + scaffold**: `docs/design.md`; Next.js, TS strict, Tailwind, shadcn, lint, Vitest, CI; app shell with theme and tokens.
2. **Domain + mocks**: types, Zod, seed, MSW handlers, `lib/format` with unit tests, rule → sentence with tests.
3. **Approval queue**: full screen from 4.1 with tests for approve/reject and rollback.
4. **Decisions + verdicts**: list, detail, jose sign/verify with tamper demo, tests for verify.
5. **Payment timeline**: viem + Solana read clients, real testnet tx, all states.
6. **Polish + ship**: axe + keyboard pass, mobile check, deploy to Vercel, README with screenshots/GIF and live link, `docs/decisions.md` (5–8 short decisions and trade-offs).

---

## 8. Definition of done

- `pnpm lint && pnpm typecheck && pnpm test` green in CI.
- No `any`, no float money, no hard-coded colours outside tokens.
- Loading, empty and error states on every screen.
- Approve flow works with keyboard only; axe reports no serious violations.
- Live on Vercel. README says what it is, the stack, that it is not affiliated with any company, and that it was built with AI assistance (Claude Code) and reviewed by me.

---

## 9. Working rules for the agent

- One phase at a time; stop at the end of each phase and summarise what was built and why.
- Record non-obvious decisions in `docs/decisions.md`.
- Small, readable components over clever abstractions.
- Ask before adding any runtime dependency not listed above. Standard dev tooling (test, lint, format helpers) is fine without asking (D-004).
- Never add wallet signing, private keys or mainnet calls.
