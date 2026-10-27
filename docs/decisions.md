# Decisions

Short records of non-obvious choices and their trade-offs, newest last. IDs are stable: code comments refer to them.

---

## D-001: Smaller `text-sm` / `text-base` than Tailwind's defaults

**Phase 1.** `text-sm` = 13/20px, `text-base` = 14/22px, plus a new `text-md` = 16/24px, set in `@theme`.

**Why:** A dense finance table fits more rows and columns at 13px. Overriding the tokens keeps every size in one place, with no arbitrary `text-[13px]`.

**Trade-offs:**
- shadcn components render a little smaller than in their docs.
- `text-base` isn't 16px here. `docs/design.md` §3.4 is the reference.
- Nothing meaningful goes below 12px. Sizes are in `rem`, so 200% zoom still works.

---

## D-002: Brand colour token is `--brand`, not `--accent`

**Phase 1.** The indigo accent is `--brand` (with `-foreground` and `-muted`), and shadcn's `--primary` aliases it.

**Why:** shadcn already uses `--accent` for subtle hover backgrounds. Reusing the name would recolour every hover or make the name mean two things.

**Trade-off:** One more alias layer in `globals.css`.

---

## D-003: next-themes and sonner added to the stack

**Phase 1.** Both are shadcn's standard choices.
- `next-themes` gives no-flash dark mode with system preference.
- `sonner` gives an undo toast that pauses on hover and focus and calls back when it closes.

**Why:** Hand-rolled theme switching is easy to get wrong with SSR hydration. The undo flow (D-012) needs sonner's callbacks.

**Trade-off:** Two small runtime dependencies.

---

## D-004: Dev tooling is free, runtime dependencies need approval

**Phase 1.** Test, lint and format tooling can be added without asking. Runtime dependencies not in PLAN.md §2 need approval (PLAN.md §9).

**Why:** Dev tooling doesn't ship to users. Runtime dependencies affect bundle size, security and what a reviewer must understand.

**Note:** shadcn's CLI also brought `radix-ui`, `class-variance-authority`, `lucide-react`, `tw-animate-css` and `cn`. These count as "shadcn/ui".

---

## D-005: Phase-scoped installs and a pnpm build-script allowlist

**Phase 1.** Each library is installed in the phase that first uses it. `pnpm-workspace.yaml` only lets `unrs-resolver` and `sharp` run install scripts.

**Why:** An unused dependency can't be reviewed against the code that uses it. The allowlist keeps pnpm's protection against malicious install scripts.

---

## D-006: Committed spend includes requests waiting for review

**Phase 2.** Committed spend = allowed + approved + **still waiting**. A rejected request stops counting from its `reviewedAt`. See `lib/domain/spend.ts`.

**Why:** Reserving waiting amounts means a reviewer can approve the whole queue without breaking a limit, and a request's decision stays true while it waits. Without the reservation, the queue becomes order-dependent.

**Trade-offs:**
- An agent can be denied while earlier requests wait, even if those are later rejected. That's the conservative choice for a spend control.
- A rejection doesn't re-open earlier denials.

---

## D-007: Approval re-checks the agent's *current* mandate

**Phase 2.** If the mandate was replaced with lower limits (or revoked) while a request waited, `checkApproval` (`lib/domain/approval-check.ts`) lists every breach.
- The queue shows it as `limitWarning`.
- `POST …/approve` answers **409 `LIMIT_WARNING`** unless the body has `acknowledgeLimitWarning: true`.
- The seed has one case: Support Bot v1 → v2 lowers the daily limit while a 250.00 request waits.

**Why:** The reviewer can still approve on purpose, but never by accident, even from a stale screen.

**Trade-off:** The human decides whether the old or new mandate wins.

---

## D-008: Seed clock follows "now", with a 14:00 UTC anchor

**Phase 2.** The seed is generated for the latest 14:00 UTC at or before now. Tests use the fixed anchor 27 Oct 2026 14:00 UTC.

**Why:** A fixed date looks stale a week after deploy. Shifting stored timestamps instead would break monthly-limit results across month ends. Generating per anchor keeps every stored decision equal to what the evaluator returns.

**Trade-offs:**
- Ids, amounts and order never change. Times move with the day.
- Data Pipeline's monthly-limit filler can differ on some anchors. Tests cover several anchors across month and year ends.
- Three requests arrive 30, 90 and 180 s after load, to demo polling.

---

## D-009: Schema additions to PLAN.md §3

**Phase 2.**
- `Decision.reviewResult` and `reviewReason`.
- `Payment.simulated`: only the few slot payments have real transactions (D-019). The rest show "Simulated payment".
- `verdictJwt` was a placeholder until phase 4 (D-015).

**Why:** Fake but well-formed hashes would make every payment show "Transaction not found". An explicit flag is honest and saves RPC calls.

---

## D-010: bigint over JSON as integer strings, via one Zod codec

**Phase 2.** Amounts travel as minor-unit strings (`"120000000"`) and are `bigint` in the app. `bigintString` (`lib/domain/schemas.ts`) is a Zod 4 codec: the mock encodes, the client parses, and both share one schema per endpoint (`lib/api/contract.ts`).

**Why:** `JSON.stringify` throws on bigint, and JSON numbers lose precision above 2^53. The codec rejects numbers, so an amount never passes through a float.

**Trade-off:** Wire payloads aren't readable as amounts.

---

## D-011: The mock API runs in every build, production included

**Phase 3.** MSW's service worker starts in the browser in development and in the deployed build. `MockProvider` loads it with `next/dynamic({ ssr: false })` and exposes an "API ready" flag. Queries wait for it.

**Why:** There's no backend, so without MSW the deployed demo would have no data. `ssr: false` is required because `msw/browser` has no Node build.

**Trade-offs:**
- Every visitor downloads MSW and the seed, and registers a service worker.
- If the worker fails, screens show their error state instead of loading forever.
- A reload starts over from the seed.

---

## D-012: Optimistic review through a hidden-id overlay; approvals sent from the toast

**Phase 3.**
- Approve and reject add the decision id to a small module-level set (`lib/api/review-overlay.ts`), which the queue and sidebar filter out. Rollback removes it.
- Deferred approvals (≤ 1,000.00 USDC, no warning) are sent when the undo toast closes. **Undo is the only way to cancel**: swiping the toast away also sends.
- Requests are plain async functions, not `useMutation`, so they still send and roll back after the queue unmounts.

**Why:** Polling makes cache edits fragile, because a poll during the undo window would bring the row back. The overlay keeps rows hidden whatever the poll returns.

**Trade-offs:**
- The state is global to the tab, and tests reset it.
- Undo needs a second `focus()` call to win over sonner's focus return.

---

## D-013: A limit warning always means the confirm dialog, with Cancel focused

**Phase 3.** A request with a limit warning (D-007) never gets the undo toast. Approving it opens the same dialog used above 1,000.00 USDC, which lists the breaches and offers **Approve anyway**.
- Both dialog variants open with focus on **Cancel**, set explicitly.
- A 409 from a stale screen restores the row and reopens the dialog with the new breaches.

**Why:** Approving past the current mandate is a deliberate exception and should never be a keystroke that sends 5 seconds later.

**Trade-off:** One more click for warned items.

---

## D-014: Sidebar waiting count shares the queue's query

**Phase 3.** The **Approvals** link shows how many are waiting ("Approvals, 12 waiting" for screen readers). It reads the same query as the queue, minus the overlay.

**Why:** One cache entry means one request per poll. The count also drops and returns with approve, Undo and rollback.

**Trade-offs:**
- The approvals query polls every 10 s on every page while the tab is visible.
- Also in this phase: TanStack Table is pinned to v8, as planned.

---

## D-015: Verdicts are signed with a per-load key whose kid is its thumbprint

**Phase 4.** The mock generates an ES256 key pair on each load, signs every decision with it, and publishes only the public half at `GET /api/jwks`. The `kid` is the RFC 7638 thumbprint. The browser verifies with jose (`lib/verdict/verify.ts`). Failures come back as `signature`, `unknown_key` or `malformed`, each with a plain message.

**Why:** No private key is ever committed, and `jwkSchema` strips private members. A key-derived kid reports a verdict from another load as "unknown key", not as tampering.

**Trade-offs:**
- Tokens differ per load, so one can't be checked on jwt.io against a stable key.
- Signing ~200 verdicts makes the first response a few ms slower.
- The JWKS comes from the same mock that signs. The demo proves the mechanism, not trust in an issuer.

---

## D-016: A verdict covers the rule decision only, with no expiry

**Phase 4.** The signed payload is what the rules said: ids, agent, vendor, amount, chain, mandate and version, outcome, reason code, `iss`, `iat`. Reviews don't re-sign it, and there's no `exp`.

**Why:** A review is a later human action, and folding it in would mean re-signing history. An expiry would only make old records fail.

**Trade-off:** The review result isn't cryptographically provable. A signed review receipt would be the next step.

---

## D-017: Tamper flips the outcome and keeps the original signature

**Phase 4.** The switch re-encodes the payload with `outcome` flipped (deny/review → allow, allow → deny) and keeps the original header and signature. The changed line is tagged "changed, was …".

**Why:** Turning a denial into an allow is exactly what a signed verdict must stop.

**Trade-off:** One fixed edit, not a free-form editor.

---

## D-018: Decisions list filters live in the URL and run on the server

**Phase 4.** `/decisions?outcome=deny&agent=agt_ops` is read with `useSearchParams` and passed to `GET /api/decisions`. Each combination is its own query, with `keepPreviousData`.
- The outcome filter is a single-select ToggleGroup, not Tabs: there are no tab panels.
- Each row has one real link, stretched over the row.
- 404s aren't retried.

**Why:** Back returns to the same filtered list, and a filtered view can be shared.

**Trade-offs:**
- The page number isn't in the URL.
- `useSearchParams` needs a Suspense boundary.

---

## D-019: Real testnet transfers from strangers, with adopted amounts and an address book

**Phase 5.** The real-tx slots hold existing small USDC transfers found by `scripts/find-testnet-txs.ts` (read-only RPC). The seed adopts each transfer's amount, and labels its two wallets after the agent and vendor.
- One slot is a hash that doesn't exist, for "not found".
- No reverted USDC payment was found, so the failed slot stays simulated. The real Failed state is covered by tests.

**Why:** Sending payments would need a funded wallet and a private key, which the plan rules out. Adopting the amounts keeps header, timeline and chain in agreement.

**Trade-offs:**
- The wallet labels are invented, and the README says so.
- Devnet can prune history. A missing transaction then shows "not found", and the script can be re-run.
- web3.js v1 can't fetch v0 transactions. None of the seeded ones are v0.

---

## D-020: Onchain reads: lazy clients, cache by finality, retries in one place

**Phase 5.**
- viem and web3.js are only reached through `await import()` in `lib/api/payments.ts`. Other routes never download them.
- Both chains return one `OnchainTx` shape: pending, not_found, confirmed or failed.
- Settled transactions are cached forever. Pending ones refetch every 5 s. "Not found" waits for Retry.
- Library retries are off. TanStack Query retries 3 times with backoff, then shows "rate-limited" or "unreachable" with Retry.

**Why:** Public testnet RPCs are slow and rate-limit, so the page asks as rarely as the data allows. One retry policy is easier to reason about than three stacked ones.

**Trade-offs:**
- The Base revert reason isn't shown, because it would take another call.
- Unit tests drive the real clients against JSON-RPC fixtures (`mocks/rpc.ts`). The UI test mocks the chain modules, because importing viem there timed out on Windows.
- Route sizes, measured in phase 6: `/payments/[id]` first load is 308 kB, below `/approvals` (337 kB). The chain libraries load only when a transaction is fetched.

---

## D-021: Timeline times come from the seed, block time only in the onchain card

**Phase 5.** The steps show seed times. The onchain card has a **Block time** row from the chain.

**Why:** Seed times move with the day (D-008), but block times are fixed. A block time on the step would soon show a confirmation days *before* the request.

**Trade-off:** For real transactions, the block time and the "Submitted" time disagree. The row label makes clear which clock it is.

---

## D-022: e2e runs against a production build, with test knobs injected before load

**Phase 6.** `pnpm e2e` runs Playwright (Chromium, at 1280px and 375px) against `next build && next start` on port 3100, built into `.next-e2e` (`distDir` from `NEXT_DIST_DIR`).
- Before the page loads, the tests set `window.__ASC_MOCK__`, which turns off the 10% random failures and shortens latency.
- Testnet RPC calls are answered from the unit-test fixtures (`mocks/rpc.ts`, through MSW's `getResponse`).
- Only `pnpm screenshots` reads the live testnet.
- e2e runs locally, not in CI.

**Why:**
- A production build is what Vercel serves, so every run also proves that MSW and its worker work in production.
- A separate build folder never collides with a running dev server.
- Random failures and public RPCs would make the suite flaky.

**Trade-offs:**
- Each run builds first, which takes about a minute.
- The `__ASC_MOCK__` hook ships in the bundle. It only tunes the mock.
- Next.js adds `.next-e2e/types` to `tsconfig.json`.
- Without CI, regressions are caught only when someone runs `pnpm e2e`.

---

## D-023: Accessibility fixes from the phase 6 pass

**Phase 6.** Found by axe, the keyboard walkthrough and the 375px checks:
- **No focus ring on buttons.** shadcn's `outline-none` sets Tailwind v4's `--tw-outline-style: none`, so `focus-visible:outline-2` drew nothing. Fixed by adding `focus-visible:outline-solid` to `Button`. A Tab sweep over every page now checks for a visible indicator at each stop.
- **Undo unreachable on mobile.** After approving, the sheet opened for the next request and covered the undo toast. It also trapped focus away from the toast. On mobile, the next row is now selected with the sheet closed.
- **The "full-screen" sheet was 75% wide.** shadcn's `data-[side=right]:w-3/4` beat our `w-full`. Fixed with `data-[side=right]:w-full`.
- **Verdict code blocks** scroll sideways on phones but couldn't take focus (axe `scrollable-region-focusable`). They now have `tabIndex={0}`.
- Added `app/not-found.tsx` and `app/error.tsx`.

**Trade-offs:**
- The code blocks are tab stops on desktop too, where they rarely scroll.
- The e2e flow moves the mouse off the toast after approving, because a hovered toast pauses and never sends. Check this on a real phone: a tap may leave a hover state under the toast.

---

## D-024: The app waits for the mock worker and reconnects it when a request misses

**After phase 6.** Requests to `/api/*` sometimes reached Next.js and came back as its HTML 404 page. The app read that as "not found" and every screen broke. MSW's worker keeps the pages it mocks in an in-memory set (`activeClientIds`). When the browser stops an idle worker, the set is lost and requests pass straight through. A hard reload (Shift+Reload) has a similar effect: the page loads without a service worker.

The fix has four parts:
- **Page content waits for the worker.** `MockReady` in the layout mounts pages only once `worker.start()` has resolved. The shell renders straight away.
- **A hard reload gets one more reload.** If the page still has no controller after start, it reloads once. A `sessionStorage` flag stops a loop, and a controlled load clears the flag.
- **The fetch layer reconnects.** Every mock response is JSON, so `fetchJson` reads a non-JSON answer as a request that missed the mock. It re-sends MSW's `MOCK_ACTIVATE` message (`reactivateWorker`) and retries once. If that fails too, it throws `API_UNAVAILABLE` (503), and screens show their error state with Retry.
- **`isNotFound` checks our own `NOT_FOUND` code.** A 404 from anywhere else no longer shows a not-found screen.

**Why not drop the service worker?** An in-memory adapter behind `lib/api` would avoid all of this. It would also take requests out of the Network tab and stop the demo from showing a real HTTP boundary. Kept MSW for now; the adapter is the fallback if this proves flaky.

**Trade-offs:**
- `reactivateWorker` relies on MSW's internal message name (`MOCK_ACTIVATE`/`MOCKING_ENABLED`). An MSW upgrade could change it; `e2e/mock-recovery.spec.ts` would catch that.
- Retrying a mutation is safe only because a request that missed the mock never changed any state.
- A hard reload costs one extra page load.
