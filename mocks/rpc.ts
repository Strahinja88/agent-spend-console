import { http } from "msw"
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  numberToHex,
  type Address,
  type Hash,
} from "viem"

import { BASE_USDC, RPC_URLS, SOLANA_USDC_MINT } from "@/lib/chain/config"

// JSON-RPC mocks for tests. The real viem and web3.js clients talk to these,
// so tests cover their request and decoding paths, not a stubbed module.

type RpcResult = unknown
type Method = (params: unknown[]) => RpcResult | Response

type RpcCall = { id: number | string; method: string; params?: unknown[] }

/** A rate-limit answer like the public endpoints send. */
export const tooManyRequests = () =>
  new Response("Too Many Requests", { status: 429 })

/**
 * One handler for an RPC URL, answering by method. A method without a mock
 * answers with a JSON-RPC error, so a test never silently passes on it.
 */
export function rpcHandler(url: string, methods: Record<string, Method>) {
  const answer = (call: RpcCall) => {
    const method = methods[call.method]
    if (!method) {
      return {
        jsonrpc: "2.0",
        id: call.id,
        error: { code: -32601, message: `No mock for ${call.method}` },
      }
    }
    const result = method(call.params ?? [])
    return result instanceof Response
      ? result
      : { jsonrpc: "2.0", id: call.id, result }
  }

  return http.post(url, async ({ request }) => {
    const body = (await request.json()) as RpcCall | RpcCall[]
    if (!Array.isArray(body)) {
      const result = answer(body)
      return result instanceof Response ? result : Response.json(result)
    }
    const results = body.map(answer)
    const failed = results.find((r) => r instanceof Response)
    return failed ?? Response.json(results)
  })
}

// ------------------------------------------------------------------- Base

export const BASE_FROM: Address = "0x7B0922C719D7e29e555A4c0ddD842F7eF3F58cF7"
export const BASE_TO: Address = "0x92043f2C69c062950a6736c26c851C2277B037B7"
export const BASE_HASH: Hash =
  "0x2a948d15b0f2e549fcdccc4891a477a23db0c45babc6bd5da71b611d5adf5b71"
const BLOCK_HASH: Hash = `0x${"b1".repeat(32)}`
/** 2026-10-27T16:14:54Z */
export const BASE_BLOCK_TIME = 1_793_117_694

type TransferLog = {
  from: Address
  to: Address
  value: bigint
  token?: Address
}

function transferLog(log: TransferLog, index: number, blockNumber: bigint) {
  return {
    address: log.token ?? BASE_USDC,
    topics: encodeEventTopics({
      abi: erc20Abi,
      eventName: "Transfer",
      args: { from: log.from, to: log.to },
    }),
    data: encodeAbiParameters([{ type: "uint256" }], [log.value]),
    blockNumber: numberToHex(blockNumber),
    blockHash: BLOCK_HASH,
    transactionHash: BASE_HASH,
    transactionIndex: "0x1",
    logIndex: numberToHex(index),
    removed: false,
  }
}

function receipt(
  status: "success" | "reverted",
  blockNumber: bigint,
  logs: TransferLog[],
) {
  return {
    transactionHash: BASE_HASH,
    transactionIndex: "0x1",
    blockHash: BLOCK_HASH,
    blockNumber: numberToHex(blockNumber),
    from: BASE_FROM,
    to: BASE_USDC,
    cumulativeGasUsed: "0x5208",
    gasUsed: "0x5208",
    effectiveGasPrice: "0x1",
    contractAddress: null,
    logs: logs.map((l, i) => transferLog(l, i, blockNumber)),
    logsBloom: `0x${"0".repeat(512)}`,
    status: status === "success" ? "0x1" : "0x0",
    type: "0x2",
  }
}

function block(number: bigint) {
  return {
    number: numberToHex(number),
    hash: BLOCK_HASH,
    parentHash: `0x${"a0".repeat(32)}`,
    timestamp: numberToHex(BASE_BLOCK_TIME),
    nonce: "0x0000000000000000",
    difficulty: "0x0",
    gasLimit: "0x1c9c380",
    gasUsed: "0x5208",
    miner: "0x4200000000000000000000000000000000000011",
    extraData: "0x",
    baseFeePerGas: "0x1",
    logsBloom: `0x${"0".repeat(512)}`,
    transactionsRoot: `0x${"c0".repeat(32)}`,
    stateRoot: `0x${"d0".repeat(32)}`,
    receiptsRoot: `0x${"e0".repeat(32)}`,
    sha3Uncles: `0x${"f0".repeat(32)}`,
    size: "0x100",
    totalDifficulty: "0x0",
    uncles: [],
    transactions: [],
  }
}

const pendingTransaction = {
  hash: BASE_HASH,
  from: BASE_FROM,
  to: BASE_USDC,
  input: "0xa9059cbb",
  nonce: "0x1",
  value: "0x0",
  gas: "0x5208",
  maxFeePerGas: "0x2",
  maxPriorityFeePerGas: "0x1",
  type: "0x2",
  chainId: "0x14a34",
  v: "0x0",
  r: `0x${"1".repeat(64)}`,
  s: `0x${"2".repeat(64)}`,
  yParity: "0x0",
  accessList: [],
  blockHash: null,
  blockNumber: null,
  transactionIndex: null,
}

export type BaseScenario =
  | {
      kind: "confirmed"
      blockNumber?: bigint
      logs?: TransferLog[]
      latest?: bigint
    }
  | { kind: "reverted"; blockNumber?: bigint }
  | { kind: "pending" }
  | { kind: "not_found" }
  | { kind: "rate_limited" }

/** Base Sepolia answering one transaction's lookups the way `scenario` says. */
export function baseRpc(scenario: BaseScenario) {
  if (scenario.kind === "rate_limited") {
    return rpcHandler(RPC_URLS.base, {
      eth_getTransactionReceipt: tooManyRequests,
      eth_getTransactionByHash: tooManyRequests,
      eth_getBlockByNumber: tooManyRequests,
      eth_blockNumber: tooManyRequests,
    })
  }
  const blockNumber =
    "blockNumber" in scenario && scenario.blockNumber
      ? scenario.blockNumber
      : 50_979_128n
  const latest =
    scenario.kind === "confirmed" && scenario.latest
      ? scenario.latest
      : blockNumber + 41n

  return rpcHandler(RPC_URLS.base, {
    eth_getTransactionReceipt: () => {
      if (scenario.kind === "confirmed") {
        const logs = scenario.logs ?? [
          { from: BASE_FROM, to: BASE_TO, value: 2_000_000n },
        ]
        return receipt("success", blockNumber, logs)
      }
      if (scenario.kind === "reverted") {
        return receipt("reverted", blockNumber, [])
      }
      return null
    },
    eth_getTransactionByHash: () =>
      scenario.kind === "pending" ? pendingTransaction : null,
    eth_getBlockByNumber: () => block(blockNumber),
    eth_blockNumber: () => numberToHex(latest),
  })
}

// ----------------------------------------------------------------- Solana

export const SOLANA_FROM = "6ReP5NF6SrSgXnqhVUfn3Ytg9eofgEcYeRNEMV6oAnyF"
export const SOLANA_TO = "4bhPq9EZAqBJgt4eL5F6WPPD7caMDW7wug6J88RZsiSz"
export const SOLANA_SIGNATURE =
  "5dgvXs8Wrv1dX1ApZjmqGxoeP4vwYAM1W2Fu1ijnaFmo5Rh9tGJkNVjnEd5vmYuabQhQ8BnAddY76gqcxEzDiPno"
export const SOLANA_SLOT = 515_751_111
/** 2026-10-27T16:20:16Z */
export const SOLANA_BLOCK_TIME = 1_793_118_016

const OTHER_MINT = "So11111111111111111111111111111111111111112"
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"

type Balance = { owner: string; amount: bigint; mint?: string }

function tokenBalance({ owner, amount, mint }: Balance, accountIndex: number) {
  return {
    accountIndex,
    mint: mint ?? SOLANA_USDC_MINT,
    owner,
    programId: TOKEN_PROGRAM,
    uiTokenAmount: {
      amount: amount.toString(),
      decimals: 6,
      uiAmount: null,
      uiAmountString: amount.toString(),
    },
  }
}

function parsedTransaction(err: unknown, pre: Balance[], post: Balance[]) {
  return {
    slot: SOLANA_SLOT,
    blockTime: SOLANA_BLOCK_TIME,
    version: 0,
    meta: {
      err,
      fee: 5000,
      preBalances: [1_000_000, 0],
      postBalances: [995_000, 0],
      innerInstructions: [],
      logMessages: [],
      preTokenBalances: pre.map(tokenBalance),
      postTokenBalances: post.map(tokenBalance),
      loadedAddresses: { writable: [], readonly: [] },
      computeUnitsConsumed: 6000,
    },
    transaction: {
      signatures: [SOLANA_SIGNATURE],
      message: {
        accountKeys: [
          {
            pubkey: SOLANA_FROM,
            signer: true,
            writable: true,
            source: "transaction",
          },
          {
            pubkey: SOLANA_TO,
            signer: false,
            writable: true,
            source: "transaction",
          },
        ],
        instructions: [],
        recentBlockhash: "EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k",
      },
    },
  }
}

/** A plain payment: SOLANA_FROM pays `amount` USDC to SOLANA_TO. */
export function solanaPayment(amount: bigint): {
  pre: Balance[]
  post: Balance[]
} {
  return {
    pre: [
      { owner: SOLANA_FROM, amount: 50_000_000n },
      { owner: SOLANA_TO, amount: 0n },
    ],
    post: [
      { owner: SOLANA_FROM, amount: 50_000_000n - amount },
      { owner: SOLANA_TO, amount },
    ],
  }
}

/** Another token moving: no USDC transfer in it. */
export const otherTokenPayment = {
  pre: [
    { owner: SOLANA_FROM, amount: 5n, mint: OTHER_MINT },
    { owner: SOLANA_TO, amount: 0n, mint: OTHER_MINT },
  ],
  post: [
    { owner: SOLANA_FROM, amount: 0n, mint: OTHER_MINT },
    { owner: SOLANA_TO, amount: 5n, mint: OTHER_MINT },
  ],
}

export type SolanaScenario =
  | {
      kind: "confirmed"
      finality?: "confirmed" | "finalized"
      balances?: { pre: Balance[]; post: Balance[] }
    }
  | { kind: "failed" }
  | { kind: "pending" }
  | { kind: "not_found" }
  | { kind: "rate_limited" }

/** Solana devnet answering one signature's lookups the way `scenario` says. */
export function solanaRpc(scenario: SolanaScenario) {
  if (scenario.kind === "rate_limited") {
    return rpcHandler(RPC_URLS.solana, {
      getSignatureStatuses: tooManyRequests,
      getTransaction: tooManyRequests,
    })
  }
  const finality =
    scenario.kind === "confirmed"
      ? (scenario.finality ?? "finalized")
      : "finalized"
  const err =
    scenario.kind === "failed" ? { InstructionError: [0, { Custom: 1 }] } : null

  return rpcHandler(RPC_URLS.solana, {
    getSignatureStatuses: () => ({
      context: { slot: SOLANA_SLOT + 40 },
      value: [
        scenario.kind === "not_found"
          ? null
          : {
              slot: SOLANA_SLOT,
              confirmations: scenario.kind === "pending" ? 0 : null,
              err,
              status: err ? { Err: err } : { Ok: null },
              confirmationStatus:
                scenario.kind === "pending" ? "processed" : finality,
            },
      ],
    }),
    getTransaction: () => {
      if (scenario.kind === "pending" || scenario.kind === "not_found") {
        return null
      }
      const { pre, post } =
        scenario.kind === "confirmed"
          ? (scenario.balances ?? solanaPayment(1_000_000n))
          : { pre: [], post: [] }
      return parsedTransaction(err, pre, post)
    },
  })
}
