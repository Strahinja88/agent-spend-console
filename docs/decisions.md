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
