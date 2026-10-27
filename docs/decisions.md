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
- Real-tx slots (`mocks/seed/tx-slots.ts`) are small payments (2.50, 3.00 and 4.00 USDC) so faucet USDC covers them. A slot stays simulated until its hash is filled in. (Phase 5 filled them with existing transfers and adopted their amounts instead, see D-019.)
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

---

## D-015: Verdicts are signed with a per-load key whose kid is its thumbprint

**Date:** 2026-10-27 · **Phase:** 4 (decisions + verdicts)

**Decision:** The mock API generates an ES256 key pair with jose when its db is created (each page load), signs every decision with it (`mocks/db.ts`, `lib/verdict/sign.ts`), and publishes only the public half at `GET /api/jwks`. The `kid` is the key's RFC 7638 JWK thumbprint, not a fixed name. The browser verifies with `createLocalJWKSet` + `jwtVerify` (`lib/verdict/verify.ts`), which never throws: it returns `signature`, `unknown_key` or `malformed` with a plain-language message. This replaces the `alg: "none"` placeholder from D-009.

**Why:**
- No private key is ever committed (PLAN.md §2 security). The private key only lives in page memory, and `jwkSchema` strips anything but public members, so `d` can't leak through the JWKS.
- A key-derived kid means a verdict from another load is reported as **unknown key**, not as a generic signature failure. A fixed `demo-1` would match the new key and fail the signature check, which reads as tampering.

**Trade-offs:**
- JWTs differ on every load, so one can't be pasted into jwt.io and verified against a stable key.
- The mock signs ~200 verdicts at start, so `getDb()` is now async and the first response arrives a few ms later. Held-back requests are signed as they arrive; releases are serialised so concurrent requests can't release one twice.
- The JWKS comes from the same mock that signs, so the demo proves the mechanism, not trust in an issuer. A real system would pin the issuer's JWKS URL.
- One test (`main-nav.test.tsx`, fake timers) now waits for the first response before advancing the poll clock, because WebCrypto work isn't covered by fake timers.

---

## D-016: A verdict covers the rule decision only, with no expiry

**Date:** 2026-10-27 · **Phase:** 4 (decisions + verdicts)

**Decision:** The signed payload is what the rules said when the request was made: decision, request, agent, vendor, amount (minor units as a string), chain, mandate id + version, outcome, reason code, `iss`, `iat` (`lib/verdict/claims.ts`). The review result isn't in it, and approving or rejecting doesn't re-sign. There is no `exp`.

**Why:** The review is a later human action; the page shows it next to the verdict, but folding it in would mean re-signing history. A verdict is a record of a past decision, so an expiry would only make old records fail verification.

**Trade-off:** The review result isn't cryptographically provable in this demo. A signed review receipt would be the natural follow-up.

---

## D-017: Tamper flips the outcome and keeps the original signature

**Date:** 2026-10-27 · **Phase:** 4 (decisions + verdicts)

**Decision:** The **Tamper with payload** switch re-encodes the payload with `outcome` changed (deny or review → allow, allow → deny) and keeps the original header and signature segments (`tamperVerdict` in `lib/verdict/decode.ts`). The changed line is tagged "changed, was …" in text, the previous result is cleared (a result is kept together with the token it was for), and the encoded token is shown under a disclosure.

**Why:** Turning a denial into an allow is the attack a verdict exists to stop, and changing only the payload shows exactly what the signature protects.

**Trade-off:** It's one fixed edit, not a free-form editor. That's enough to show the failure without a JSON editor to build and test.

---

## D-018: Decisions list filters live in the URL and run on the server; outcome is a toggle group

**Date:** 2026-10-27 · **Phase:** 4 (decisions + verdicts)

**Decision:**
- `/decisions?outcome=deny&agent=agt_ops`: filters are read with `useSearchParams` and written with `router.replace` (`features/decisions/use-decision-filters.ts`), then passed to the existing `GET /api/decisions?outcome=&agentId=`. Each filter combination is its own query (`queryKeys.decisions(filters)`) with `keepPreviousData`, so switching doesn't flash skeletons. Pagination (25 per page) is client-side over the filtered result.
- The outcome filter is a single-select shadcn **ToggleGroup** (radio semantics, labelled "Outcome"), not Tabs: ARIA tabs promise tab panels, and this is one list with a filter.
- Each row has one real link (agent name), stretched over the row with an `after:` box (DataTable gained a `rowClassName` prop). Its accessible name adds the amount and vendor, so a list of links isn't just repeated agent names.
- A review in the queue invalidates the decision list and detail caches, so they show the final state.
- The app's QueryClient doesn't retry 404s (`isNotFound` in `lib/api/client.ts`): asking again won't make a missing decision appear.

**Why:** Back from a decision returns to the same filtered list, and a filtered view can be shared as a link. Server-side filtering uses the contract that already exists.

**Trade-offs:**
- `useSearchParams` needs a Suspense boundary in the page (`app/decisions/page.tsx`).
- The page number isn't in the URL, so Back returns to page 1 of the same filter.
- "View payment ›" links to a placeholder `/payments/[id]` until phase 5.

---

## D-019: Real testnet transfers from strangers, with adopted amounts and an address book

**Date:** 2026-10-27 · **Phase:** 5 (payment timeline)

**Decision:**
- The real-tx slots hold **existing recent USDC transfers** found by `scripts/find-testnet-txs.ts` (read-only RPC, no wallet), not transfers sent for this demo. The script first checks the USDC addresses onchain (Base: `symbol()` = USDC, `decimals()` = 6; Solana: the mint has 6 decimals; both also match Circle's docs). It keeps only successful, direct transfers of 1.00 to 9.99 USDC with exactly one USDC movement.
- **The seed adopts each transfer's amount** (2.00, 1.00, 1.00 USDC replace 2.50, 3.00, 4.00). The scripted requests read it from the slot, so the evaluator re-check (design.md §2.4) still covers them. The page then checks "Matches the approved amount".
- **Address book (a demo fiction):** the seed names each transfer's two wallets after the request's agent and vendor ("Research Bot wallet", "Weather API wallet") and sends them as `addressLabels` with the payment. Only those addresses get a label. The wallets belong to unknown testnet users.
- Two slots exist for the error states: `base-missing` (a random hash the script confirmed doesn't exist → "not found") and `base-failed` (a reverted USDC payment call). A scan of ~6,000 Base Sepolia blocks (about 3 hours) found no reverted USDC payment, so `base-failed` has no hash and stays simulated ("Failed (simulated)"). The real Failed state is covered by tests with mocked RPC. They're the two Ops Agent 100.00 payments that were already scripted as `submitted` and `failed`, so their amounts, and the §6.1 numbers that depend on them, don't change.
- `Payment.submittedAt` (optional) was added for the Submitted step: approval time + 1 minute in the seed.

**Why:** Sending payments would need a funded wallet and a private key, which PLAN.md rules out even on testnet. Adopting the amount keeps header, timeline and chain in agreement without hunting for exact 2.50/3.00/4.00 transfers. Labelling makes the sketch's "sent to Weather API" readable, and limiting labels to the book keeps every other address honest.

**Trade-offs:**
- The labels are invented. README and this record say so.
- Devnet can be reset and its RPC can prune history. A missing Solana transaction then shows "not found", which is the right state, and the script can be re-run.
- Public `sepolia.base.org` only allows 200-block `eth_getLogs` ranges, so the script scans in 200-block chunks. Finding a revert means reading whole blocks, which is slow; the scan length is an argument.
- Devnet now also serves version 1 transactions, which web3.js v1 can't fetch (RPC error -32015). The script skips them. The app would show one as an RPC error after retries; none of the seeded transactions is v1.
- The script runs with Node 24's built-in type stripping (`node --no-warnings scripts/find-testnet-txs.ts`), so it needs no `tsx`, but it can't use the `@/` aliases and repeats the two USDC constants.

---

## D-020: Onchain reads: lazy clients, cache by finality, retries in one place

**Date:** 2026-10-27 · **Phase:** 5 (payment timeline)

**Decision:**
- `lib/chain/base.ts` (viem) and `lib/chain/solana.ts` (web3.js) are only reached through `await import()` in the query functions (`lib/api/payments.ts`). Everything else imports `lib/chain/config.ts`, `types.ts` and `errors.ts`, which have no dependencies. So other routes never download viem or web3.js, and the payment page only downloads the one its chain needs.
- Both clients return one `OnchainTx` shape: `pending`, `not_found`, `confirmed` (with the USDC transfers) or `failed` (with a reason).
  - Base: receipt → USDC `Transfer` logs (only those emitted by the USDC contract) → block time. No receipt: `eth_getTransactionByHash` tells pending from not found.
  - Solana: `getSignatureStatus` (history search on) for processed / confirmed / finalized, then `getParsedTransaction` for slot, time, error and token balances. The amount and wallets come from the USDC balance change per owner, which works for `transfer` and `transferChecked` alike.
- **Caching:** confirmed and failed transactions get `staleTime: Infinity` (a Solana one only once finalized). Pending ones, and confirmed Solana ones not yet finalized, refetch every 5 s. "Not found" is **not polled**: it waits for Retry or a window refocus. Confirmations come from a separate `getBlockNumber` query (30 s), so the receipt stays cached while the count moves.
- **Errors and rate limits:** library retries are off (viem `retryCount: 0`, web3.js `disableRetryOnRateLimit`). TanStack Query retries RPC errors 3 times with 1 s / 2 s / 4 s backoff, then the card says the public RPC is limiting requests (HTTP 429 / JSON-RPC -32005, found anywhere in the error's cause chain) or unreachable, with Retry. Raw RPC errors are never shown.
- web3.js gets the platform `fetch` (`Connection({ fetch })`). In Node it otherwise uses its own node-fetch with a keep-alive agent, and the first test run silently hit real devnet past MSW.

**Why:** Public testnet RPCs are slow, lag and rate-limit, so the page asks as rarely as the data allows: never again for settled transactions, every 5 s only while something is settling, and not at all for a hash the RPC doesn't know. One retry policy in one place is easier to reason about and to test than three stacked ones.

**Trade-offs:**
- Cache lives for the session (default `gcTime`). A reload asks again.
- The revert reason isn't shown for Base: receipts don't carry it, and replaying the call costs another request.
- Two test layers. The unit tests in `lib/chain` drive the real viem and web3.js clients against JSON-RPC fixtures (`mocks/rpc.ts`, no network), so the fixtures must match what the libraries validate. The payment timeline UI test `vi.mock`s both chain modules with `OnchainTx` fixtures and fails if viem or web3.js load at all: importing them there timed out (over 30 s) on Windows. `lib/chain/imports.test.ts` checks that importing the chain modules makes no RPC call; the clients are created on first use.
- `pnpm-workspace.yaml` denies install scripts for `bufferutil` and `utf-8-validate` (optional WebSocket speed-ups pulled in by web3.js). Reads are HTTP only.
- `next build` route sizes weren't measured this phase (the dev server was running on the same `.next`). The static check passes: no module outside `lib/chain` imports viem or web3.js. Measure in phase 6.

---

## D-021: Timeline times come from the seed, block time only in the onchain card

**Date:** 2026-10-27 · **Phase:** 5 (payment timeline)

**Decision:** Requested, Decision, Approved and Submitted show seed times (which follow "now", D-008). "Confirmed onchain" has no step time. The onchain card has a **Block time** row from the chain, and the header's "· 3 min ago" is the block time.

**Why:** Seed times move with the day, block times are fixed. Putting the block time on the step would, a few days after the transactions were found, show a confirmation days *before* the request.

**Trade-off:** The block time and the seed's "Submitted" time disagree for real transactions. Labelling the row "Block time" makes it clear which clock it is.
