# Agent Spend Console

A portfolio demo of a finance console for AI-agent payments: an approval queue, decision detail with signed-verdict verification, and a payment timeline that reads real USDC testnet transactions on Base Sepolia and Solana devnet.

**Not affiliated with any company.** Concepts are modelled generically; decision codes are invented. Testnet only, read-only onchain, no wallets or keys.

Work in progress. See [PLAN.md](PLAN.md), [docs/design.md](docs/design.md) and [docs/decisions.md](docs/decisions.md).

## Develop

Requires Node 24 and pnpm (via `corepack enable`).

```sh
pnpm install
pnpm dev            # http://localhost:3000
pnpm lint
pnpm typecheck
pnpm test
pnpm format
```
