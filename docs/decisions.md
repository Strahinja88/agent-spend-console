# Decisions

Short records of non-obvious choices and their trade-offs. Newest last.

---

## D-001: Smaller `text-sm` / `text-base` than Tailwind's defaults

**Date:** 2026-10-27 · **Phase:** 1 (design)

**Decision:** Override Tailwind's type scale in `@theme`: `text-sm` = 13px / 20px (default 14px), `text-base` = 14px / 22px (default 16px), and add `text-md` = 16px / 24px.

**Why:** The console is a dense, data-heavy finance tool. 13px table bodies fit more rows and columns on screen without horizontal scrolling, and 14px UI text matches the density of comparable tools. Overriding the tokens, rather than using arbitrary values like `text-[13px]`, keeps every size in one place and keeps "no hard-coded values outside tokens" true.

**Trade-offs:**
- This applies globally, including inside shadcn components (which use `text-sm` for most body text), so shadcn renders slightly smaller than its docs show. That's intended.
- Anyone used to Tailwind's defaults may expect `text-base` to be 16px; `docs/design.md` §3.4 is the reference.
- 13px is the floor. Nothing that carries meaning goes below `text-xs` (12px), and users can still zoom to 200% (WCAG 1.4.4) because sizes are in `rem`.

---

## D-002: Brand colour token is `--brand`, not `--accent`

**Date:** 2026-10-27 · **Phase:** 1 (design)

**Decision:** The single indigo accent colour is named `--brand` (`--brand-foreground`, `--brand-muted`). shadcn's `--primary` is aliased to it.

**Why:** shadcn already uses `--accent` for subtle hover backgrounds (menu items, ghost buttons). Reusing the name for the brand colour would either recolour every hover state indigo or make the name mean two things.

**Trade-off:** One more alias layer in `globals.css` (see `docs/design.md` §3.7).

---

## D-003: Add next-themes and sonner to the stack

**Date:** 2026-10-27 · **Phase:** 1 (scaffold)

**Decision:** Add `next-themes` (installed in phase 1) and `sonner` (installed in phase 3, when the queue needs it) to PLAN.md §2.

**Why:**
- **next-themes** is the standard shadcn approach to dark mode. It injects a blocking script so the right theme class is on `<html>` before first paint (no flash), follows the system preference, and syncs across tabs. Hand-rolling this is ~30 lines that are easy to get subtly wrong with SSR hydration.
- **sonner** is shadcn's toast component. The approval queue needs an "Approved · Undo" toast whose auto-close sends the mutation, and that pauses on hover and focus (`docs/design.md` §6.1). Sonner supports both.

**Trade-off:** Two more small runtime dependencies.

---

## D-004: Dependency rule: dev tooling is free, runtime dependencies need approval

**Date:** 2026-10-27 · **Phase:** 1 (scaffold)

**Decision:** Standard dev tooling can be added without asking. Runtime dependencies not listed in PLAN.md §2 still need approval first (PLAN.md §9 updated).

Added under this rule in phase 1, following the standard Next.js + Vitest setup:
- `jsdom`: DOM environment for Vitest
- `@testing-library/react`, `/dom`, `/jest-dom`, `/user-event`
- `@vitejs/plugin-react`: JSX in tests. (`vite-tsconfig-paths` was planned, but Vite now resolves `@/` aliases natively with `resolve.tsconfigPaths`, so it wasn't kept.)
- `prettier-plugin-tailwindcss`, `eslint-config-prettier`

**Why:** Dev tooling doesn't ship to users or widen the runtime attack surface, and asking each time slows down every phase. Runtime dependencies affect bundle size, security and what the reviewer has to understand, so they stay gated.

**Note:** shadcn's current CLI also pulled in `radix-ui`, `class-variance-authority`, `lucide-react`, `tw-animate-css`, `cn` (shadcn's merged clsx + tailwind-merge) and `shadcn` itself (for its base CSS). These are counted as part of "shadcn/ui" in PLAN.md §2.

---

## D-005: Phase-scoped installs and pnpm build-script allowlist

**Date:** 2026-10-27 · **Phase:** 1 (scaffold)

**Decision:**
- Libraries from PLAN.md §2 are installed in the phase that first uses them (TanStack Query/Table, Zod, MSW, jose, viem, @solana/web3.js), not all in phase 1.
- `pnpm-workspace.yaml` lists the packages allowed to run install scripts (`allowBuilds`): `unrs-resolver` (used by eslint-config-next's import resolver) and `sharp` (Next.js image optimisation). pnpm blocks all others by default.

**Why:** Unused dependencies at a phase's commit can't be reviewed against code that uses them. The build-script allowlist keeps pnpm's protection against malicious install scripts while letting the two known native packages build.

---

## D-006: Committed spend includes requests waiting for review

**Date:** 2026-10-27 · **Phase:** 2 (domain)

**Decision:** Committed spend for a period = allowed + approved after review + **still waiting for review**. Denied requests never count. A rejected request stops counting from its `reviewedAt`, so requests evaluated before the rejection still saw it as reserved. Defined in `lib/domain/spend.ts` (`committedSpend`, `countsAsCommitted`).

**Why:** Reserving waiting amounts means a reviewer can approve everything in the queue without breaking a limit, so approval never has to re-run the limits of the mandate the request was evaluated under, and the decision a request got stays true for its whole life. The alternative (count only allowed + approved) makes the queue order-dependent: two requests that each fit can't both be approved, and the evaluator's answer goes stale while the request waits.

**Trade-offs:**
- An agent can be denied while earlier requests are still waiting, even if a reviewer later rejects those. That's the conservative choice for a spend control.
- A rejection doesn't re-open earlier denials. They stay denied, and the agent has to retry.

---

## D-007: Approval re-checks the agent's *current* mandate and warns

**Date:** 2026-10-27 · **Phase:** 2 (domain)

**Decision:** Because of D-006, approving can't break the mandate a request was evaluated under. It *can* break the agent's current mandate if that mandate was replaced with lower limits (or revoked) while the request waited. `checkApproval` (`lib/domain/approval-check.ts`) re-runs the hard rules against the current mandate, with committed spend as of now minus the request itself, and lists every breach as a sentence (or `NO_ACTIVE_MANDATE`).
- `GET /api/approvals` returns it per item as `limitWarning`, so the queue can warn before approving (phase 3).
- `POST /api/decisions/:id/approve` refuses with **409 `LIMIT_WARNING`** unless the body has `acknowledgeLimitWarning: true`. The reviewer can still approve on purpose, but never by accident, even from a stale screen.
- The seed has one such case: Support Bot's mandate v1 is replaced on the anchor day by v2 (daily limit 1,000.00 → 400.00) while a 250.00 request from v1 is waiting.

**Trade-off:** The reviewer, not the system, decides whether the old or new mandate wins. That fits "review" as a human judgement, and the warning keeps the choice explicit.

---

## D-008: Seed clock follows "now", 14:00 UTC anchor

**Date:** 2026-10-27 · **Phase:** 2 (mocks)

**Decision:** Seed times are written relative to an anchor (day offset + UTC time). At load, the anchor is the latest 14:00 UTC at or before now (`seedAnchor`), and the seed is generated for that anchor. Tests use the fixed anchor 27 Oct 2026 14:00 UTC, which matches the sketches in `docs/design.md`.

**Why:** A fixed date would make the demo look stale a week after deploy ("3 weeks ago" everywhere). Shifting stored timestamps was rejected because moving a seed across UTC month boundaries changes monthly-limit results, so stored decisions would no longer match the evaluator. Generating per anchor keeps every decision exactly what `evaluate` returns.

**Trade-offs:**
- Amounts, vendors, ids and order are the same on every load. Times move with the day, and on a few anchors a monthly-limit outcome of the Data Pipeline filler can differ (it's the only monthly limit). Scripted requests are checked on generation (`expect`), and the test runs several anchors across month and year ends.
- Queue ages depend on time of day: from minutes (just after 14:00 UTC) up to about a day.
- Three "held-back" requests enter the queue 30 s, 90 s and 180 s after the mock starts, so polling and "new request" announcements can be demoed. They're evaluated when they arrive, like any request.

---

## D-009: Schema additions to PLAN.md §3

**Date:** 2026-10-27 · **Phase:** 2 (domain)

**Decision:**
- `Decision.reviewResult?: 'approved' | 'rejected'` and `Decision.reviewReason?: string`, as noted in `docs/design.md` §2.2, instead of deriving the review result from `Payment.status`.
- `Payment.simulated: boolean`. Only 2–3 seed payments get real testnet transactions (PLAN.md §3). The rest have no `txHash` and `simulated: true`, and phase 5 shows "Simulated payment, no onchain transaction" for them.
- Real-tx slots (`mocks/seed/tx-slots.ts`) are small payments (2.50, 3.00 and 4.00 USDC) so faucet USDC covers them. A slot stays simulated until its hash is filled in.
- `verdictJwt` is an unsigned JWT-shaped placeholder (`alg: "none"`) until phase 4 signs verdicts with jose.

**Why:** Fake but well-formed hashes would make every other payment show "Transaction not found" in phase 5. An explicit flag is honest and saves pointless RPC calls.

---

## D-010: bigint over JSON as integer strings, via one Zod codec

**Date:** 2026-10-27 · **Phase:** 2 (domain)

**Decision:** Amounts are integer strings in minor units on the wire (`"120000000"`) and `bigint` in the app. `bigintString` in `lib/domain/schemas.ts` is a Zod 4 codec: the mock API calls `schema.encode()` and the client (`lib/api/client.ts`) calls `schema.parse()` to decode. Every endpoint has one schema in `lib/api/contract.ts` that both sides use. Domain types come from the schemas (`z.output`), so there are no hand-written duplicates.

**Why:** `JSON.stringify` throws on bigint, and JSON numbers lose precision above 2^53. The codec rejects JSON numbers, so an amount can never pass through a float. One schema for both directions means the mock and client can't disagree on the format.

**Trade-off:** Wire payloads aren't directly readable as amounts ("120000000", not "120.00"), which is the usual choice for token amounts.

---

## D-011: The mock API runs in every build, production included

**Date:** 2026-10-27 · **Phase:** 3 (approval queue)

**Decision:** MSW's service worker starts in the browser in development *and* in the deployed build. `MockProvider` (`components/mock-provider.tsx`) loads `components/mock-worker.tsx` with `next/dynamic` and `ssr: false`, and exposes an "API ready" flag (`lib/api/api-ready.ts`). Queries use `enabled: ready`, so nothing fetches before the worker is up, and pages render their skeletons meanwhile.

**Why:** There is no real backend (PLAN.md §1 non-goals), so without MSW the Vercel demo would have no data. `ssr: false` is required, not a preference: MSW 3 exports `msw/browser` with `"node": null`, so a plain dynamic import inside a client component fails the server build.

**Trade-offs:**
- Every visitor downloads MSW and the seed (part of the 34.6 kB on `/approvals`) and registers a service worker on the site's origin. Fine for a demo; a real product would swap the provider for a real API.
- First data arrives after the worker registers (a few hundred ms on a cold load). If the worker fails to start, queries run anyway and screens show their error state instead of loading forever.
- Mock state lives in the page: a reload starts over from the seed (as designed in phase 2).

---

## D-012: Optimistic review through a shared hidden-id overlay; approvals sent from the toast

**Date:** 2026-10-27 · **Phase:** 3 (approval queue)

**Decision:**
- Approve/reject don't edit the TanStack Query cache. They add the decision id to a small module-level set (`lib/api/review-overlay.ts`, read with `useSyncExternalStore`); the queue and the sidebar count filter it out. Rollback removes the id. A fetch that no longer lists an id prunes it.
- Deferred approvals (≤ 1,000.00 USDC, no limit warning) live in `features/approvals/pending-approvals.ts`. Every path that sends goes through `commitApproval`, which removes the entry first, so nothing sends twice.
- **Undo is the only way to cancel.** The toast's auto-close sends (design.md §6.1), and so does any other dismissal (swipe away, `toast.dismiss` when leaving the page). Sonner calls `onDismiss` for those, not `onAutoClose`.
- Requests are plain async functions over the shared `QueryClient` rather than `useMutation`, because a deferred approval must still send, and roll back, after the queue unmounts.

**Why:** Polling makes cache edits fragile: a poll that lands during the undo window or while a request is in flight would bring the row back. The overlay keeps hidden rows hidden whatever the poll returns (design.md §6.1), works the same for the queue and the sidebar, and makes rollback one line. Treating swipe-away as "send" matches what the reviewer saw: the toast said *Approved*, and only Undo says otherwise.

**Trade-offs:**
- Module-level state is global to the tab; tests reset it (`resetReviewOverlay`, `resetPendingApprovals`).
- Focus after Undo needs a second `focus()` call: sonner returns focus to where it was before the toast as soon as focus leaves the toast, and the second call wins (commented in `approval-queue.tsx`).

---

## D-013: A limit warning always means the confirm dialog, with Cancel focused

**Date:** 2026-10-27 · **Phase:** 3 (approval queue)

**Decision:** A request whose `limitWarning` isn't ok (D-007) never uses the undo toast, whatever its amount. Approving it (button or `a`) opens the same AlertDialog as > 1,000.00 USDC, listing the breaches, with **Approve anyway**, which sends `acknowledgeLimitWarning: true`. In both variants the dialog opens with focus on **Cancel**, set explicitly in `onOpenAutoFocus` rather than relying on Radix's default, so an accidental Enter cancels. If the server answers 409 `LIMIT_WARNING` (the mandate changed after the screen loaded), the row is restored, the queue refetches and the dialog opens with the new breaches.

**Why:** Approving past the current mandate is a deliberate exception and should take one explicit step, never a keystroke that turns into a send 5 seconds later. A checkbox in the panel was considered; it would put a second, different confirmation pattern in the same screen.

**Trade-off:** One more click for warned items, even small ones.

---

## D-014: Sidebar waiting count shares the queue's query

**Date:** 2026-10-27 · **Phase:** 3 (approval queue)

**Decision:** The **Approvals** nav link shows the number waiting (design.md §6.0), with the accessible name "Approvals, 12 waiting" (visible number `aria-hidden`, words in an `sr-only` span). It uses `useWaitingCount()`, which reads the same `useApprovals()` query (`queryKeys.approvals()`) as the queue, minus the review overlay (D-012). `Providers` now wraps the whole `AppShell`, not just the page. No count while loading, after an error, or at 0.

**Why:** One cache entry means one request per poll however many components read it, and the overlay makes the count drop the moment a reviewer acts and go back up on Undo or rollback.

**Trade-offs:**
- The approvals query now polls every 10 s on **every page** while the tab is visible (`refetchIntervalInBackground: false`; TanStack Query pauses it when the tab is hidden).
- Also in this phase: `@tanstack/react-table` is pinned to v8 as PLAN.md §2 says (`pnpm add` picked v9, which has a different API), and shadcn's `destructive` button variant is solid with white text, per design.md §3.3.
