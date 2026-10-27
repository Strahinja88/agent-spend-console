// One-off, read-only: finds real USDC testnet transactions for the seed's
// tx slots (mocks/seed/tx-slots.ts, D-019). No wallet, no keys, testnets only.
//
//   node --no-warnings scripts/find-testnet-txs.ts [blocks to scan for a revert, default 600]
//
// Uses the RPC URLs from the environment if set (same names as .env.local),
// otherwise the public endpoints. Calls are sequential and spaced out, because
// the public endpoints rate-limit.
//
// Self-contained on purpose (no "@/" imports): Node runs it directly with
// type stripping, without the app's path aliases.

import { Connection, PublicKey } from "@solana/web3.js"
import {
  createPublicClient,
  erc20Abi,
  http,
  parseEventLogs,
  toHex,
  type Hash,
} from "viem"
import { baseSepolia } from "viem/chains"

// Circle's testnet USDC, checked against developers.circle.com (PLAN.md §2)
const BASE_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
const SOLANA_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
const DECIMALS = 6

// Small transfers only: 1.00 up to (not including) 10.00 USDC. Faucet drips
// are 10.00 or more, so this skips most of them.
const MIN = 1_000_000n
const MAX = 10_000_000n
const WANTED = 3

const BASE_RPC =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL ||
  "https://api.devnet.solana.com"

const LOG_CHUNK = 200n // blocks per eth_getLogs call: sepolia.base.org allows 200
const LOG_CHUNKS = 100
const REVERT_SCAN_BLOCKS = BigInt(process.argv[2] ?? 600)

// USDC payment calls: transfer, transferFrom, and the EIP-3009
// transferWithAuthorization / receiveWithAuthorization
const TRANSFER_SELECTORS = [
  "0xa9059cbb",
  "0x23b872dd",
  "0xe3ee160e",
  "0xef55bec6",
]

const pause = (ms: number) => new Promise((done) => setTimeout(done, ms))

function usdc(minor: bigint): string {
  const whole = minor / 10n ** BigInt(DECIMALS)
  const fraction = (minor % 10n ** BigInt(DECIMALS))
    .toString()
    .padStart(DECIMALS, "0")
  return `${whole}.${fraction}`
}

function inRange(value: bigint): boolean {
  return value >= MIN && value < MAX
}

type Found = {
  hash: string
  amount: string
  from: string
  to: string
  where: string
  time: string
}

// ---------------------------------------------------------------- Base Sepolia

const base = createPublicClient({
  chain: baseSepolia,
  transport: http(BASE_RPC, { retryCount: 5, retryDelay: 1_000 }),
})

async function checkBaseUsdc() {
  const [symbol, decimals] = await Promise.all([
    base.readContract({
      address: BASE_USDC,
      abi: erc20Abi,
      functionName: "symbol",
    }),
    base.readContract({
      address: BASE_USDC,
      abi: erc20Abi,
      functionName: "decimals",
    }),
  ])
  if (symbol !== "USDC" || decimals !== DECIMALS) {
    throw new Error(`Base USDC check failed: ${symbol}, ${decimals} decimals`)
  }
  console.log(
    `✓ Base Sepolia ${BASE_USDC} is ${symbol} with ${decimals} decimals`,
  )
}

async function findBaseTransfers(latest: bigint): Promise<Found[]> {
  const found: Found[] = []
  const seen = new Set<string>()

  for (let i = 0n; i < LOG_CHUNKS && found.length < WANTED; i++) {
    const toBlock = latest - i * LOG_CHUNK
    const fromBlock = toBlock - LOG_CHUNK + 1n
    const logs = await base.getContractEvents({
      address: BASE_USDC,
      abi: erc20Abi,
      eventName: "Transfer",
      fromBlock,
      toBlock,
    })
    await pause(300)

    // Newest first, small amounts, one candidate per transaction
    for (const log of logs.reverse()) {
      if (found.length >= WANTED) break
      const { from, to, value } = log.args
      if (!from || !to || value === undefined || !inRange(value)) continue
      if (seen.has(log.transactionHash) || from === to) continue
      seen.add(log.transactionHash)

      // Keep it simple to explain: a direct call to USDC with exactly one
      // USDC transfer in it, that succeeded
      const [tx, receipt] = await Promise.all([
        base.getTransaction({ hash: log.transactionHash }),
        base.getTransactionReceipt({ hash: log.transactionHash }),
      ])
      await pause(300)
      const transfers = parseEventLogs({
        abi: erc20Abi,
        eventName: "Transfer",
        logs: receipt.logs.filter(
          (l) => l.address.toLowerCase() === BASE_USDC.toLowerCase(),
        ),
      })
      if (
        receipt.status !== "success" ||
        tx.to?.toLowerCase() !== BASE_USDC.toLowerCase() ||
        transfers.length !== 1
      ) {
        continue
      }
      const block = await base.getBlock({ blockNumber: receipt.blockNumber })
      found.push({
        hash: log.transactionHash,
        amount: usdc(value),
        from,
        to,
        where: `block ${receipt.blockNumber}`,
        time: new Date(Number(block.timestamp) * 1000).toISOString(),
      })
    }
  }
  return found
}

async function findBaseRevert(latest: bigint): Promise<Found | undefined> {
  for (let n = 0n; n < REVERT_SCAN_BLOCKS; n++) {
    const block = await base.getBlock({
      blockNumber: latest - n,
      includeTransactions: true,
    })
    await pause(150)
    const calls = block.transactions.filter(
      (tx) =>
        tx.to?.toLowerCase() === BASE_USDC.toLowerCase() &&
        TRANSFER_SELECTORS.some((s) => tx.input.startsWith(s)),
    )
    for (const tx of calls) {
      const receipt = await base.getTransactionReceipt({ hash: tx.hash })
      await pause(300)
      if (receipt.status !== "reverted") continue
      return {
        hash: tx.hash,
        amount: "(reverted, nothing moved)",
        from: tx.from,
        to: BASE_USDC,
        where: `block ${receipt.blockNumber}`,
        time: new Date(Number(block.timestamp) * 1000).toISOString(),
      }
    }
    if (n > 0n && n % 100n === 0n) console.log(`  …scanned ${n} blocks`)
  }
  return undefined
}

/** A random hash, checked to not exist, for the "not found" demo. */
async function unknownBaseHash(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const hash: Hash = toHex(bytes)
  const tx = await base.getTransaction({ hash }).catch(() => null)
  if (tx) throw new Error(`Random hash ${hash} exists, run again`)
  return hash
}

// -------------------------------------------------------------- Solana devnet

const solana = new Connection(SOLANA_RPC, "confirmed")
const mint = new PublicKey(SOLANA_USDC)

async function checkSolanaUsdc() {
  const account = await solana.getParsedAccountInfo(mint)
  const data = account.value?.data
  const decimals =
    data && "parsed" in data ? data.parsed?.info?.decimals : undefined
  if (
    data &&
    "parsed" in data &&
    data.parsed?.type === "mint" &&
    decimals === DECIMALS
  ) {
    console.log(
      `✓ Solana devnet ${SOLANA_USDC} is a token mint with ${decimals} decimals`,
    )
    return
  }
  throw new Error(`Solana USDC check failed: ${JSON.stringify(data)}`)
}

async function findSolanaTransfers(): Promise<Found[]> {
  const found: Found[] = []
  // Signatures that touch the mint account: `transferChecked` lists it
  const signatures = await solana.getSignaturesForAddress(mint, { limit: 200 })

  for (const { signature, err } of signatures) {
    if (found.length >= WANTED) break
    if (err) continue
    await pause(400)
    // Devnet now also has version 1 transactions, which web3.js v1 can't
    // fetch (RPC error -32015). The app couldn't read them either: skip.
    const tx = await solana
      .getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "finalized",
      })
      .catch(() => null)
    if (!tx?.meta || tx.meta.err) continue

    // USDC balance change per owner: exactly one sender and one receiver
    const delta = new Map<string, bigint>()
    for (const b of tx.meta.preTokenBalances ?? []) {
      if (b.mint !== SOLANA_USDC || !b.owner) continue
      delta.set(
        b.owner,
        (delta.get(b.owner) ?? 0n) - BigInt(b.uiTokenAmount.amount),
      )
    }
    for (const b of tx.meta.postTokenBalances ?? []) {
      if (b.mint !== SOLANA_USDC || !b.owner) continue
      delta.set(
        b.owner,
        (delta.get(b.owner) ?? 0n) + BigInt(b.uiTokenAmount.amount),
      )
    }
    const moved = [...delta].filter(([, d]) => d !== 0n)
    const sender = moved.find(([, d]) => d < 0n)
    const receiver = moved.find(([, d]) => d > 0n)
    if (moved.length !== 2 || !sender || !receiver) continue
    if (-sender[1] !== receiver[1] || !inRange(receiver[1])) continue

    found.push({
      hash: signature,
      amount: usdc(receiver[1]),
      from: sender[0],
      to: receiver[0],
      where: `slot ${tx.slot}`,
      time: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : "?",
    })
  }
  return found
}

// ----------------------------------------------------------------------- main

function print(title: string, list: Found[]) {
  console.log(`\n${title}`)
  if (list.length === 0) console.log("  (none found)")
  for (const f of list) {
    console.log(`  ${f.hash}`)
    console.log(
      `    ${f.amount} USDC · ${f.from} → ${f.to} · ${f.where} · ${f.time}`,
    )
  }
}

await checkBaseUsdc()
await checkSolanaUsdc()

const latest = await base.getBlockNumber()
console.log(`\nBase Sepolia latest block ${latest}`)
const baseTransfers = await findBaseTransfers(latest)
print("Base Sepolia: confirmed USDC transfers", baseTransfers)

console.log(
  `\nLooking for a reverted USDC transfer in the last ${REVERT_SCAN_BLOCKS} blocks…`,
)
const revert = await findBaseRevert(latest)
print("Base Sepolia: reverted USDC call", revert ? [revert] : [])

const unknown = await unknownBaseHash()
console.log(`\nBase Sepolia: hash checked to not exist\n  ${unknown}`)

const solanaTransfers = await findSolanaTransfers()
print("Solana devnet: confirmed USDC transfers", solanaTransfers)
