// @vitest-environment node
import { expect, it, vi } from "vitest"

// vi.hoisted runs before the imports below, so this spy sees anything the
// modules do while they're evaluated.
const fetchSpy = vi.hoisted(() =>
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network")),
)

import * as base from "./base"
import * as config from "./config"
import * as errors from "./errors"
import * as solana from "./solana"
import * as types from "./types"

it("makes no RPC calls when lib/chain modules are imported", () => {
  // Touch the modules so the imports can't be dropped as unused
  expect([base, config, errors, solana, types].every(Boolean)).toBe(true)
  expect(fetchSpy).not.toHaveBeenCalled()
  fetchSpy.mockRestore()
})
