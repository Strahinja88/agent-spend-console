import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import { jwksResponse } from "@/lib/api/contract"
import { truncateMiddle } from "@/lib/format/address"
import { decodeVerdict } from "@/lib/verdict/decode"
import { createVerdictKey } from "@/lib/verdict/sign"
import { server } from "@/mocks/node"

import { renderWithProviders, setupMockApi } from "../approvals/test-utils"
import { findSeeded } from "./test-utils"
import { VerdictPanel } from "./verdict-panel"

setupMockApi()

let jwt: string
let kid: string

beforeEach(async () => {
  // design.md §6.2b: Ops Agent, 120.00 USDC, denied under mandate v2
  const { decision } = await findSeeded("agt_ops", "120", "2026-10-18")
  jwt = decision.verdictJwt
  kid = String(decodeVerdict(jwt).header.kid)
})

function result() {
  return screen.getByRole("region", { name: "Signed verdict" })
}

async function verify(user: ReturnType<typeof userEvent.setup>) {
  const button = await screen.findByRole("button", {
    name: "Verify signature",
  })
  await waitFor(() => expect(button).toBeEnabled())
  await user.click(button)
}

describe("VerdictPanel", () => {
  it("shows the decoded header and payload", () => {
    renderWithProviders(<VerdictPanel jwt={jwt} />)
    expect(screen.getByText(/"alg": "ES256"/)).toBeInTheDocument()
    expect(screen.getByText(/"outcome": "deny"/)).toBeInTheDocument()
    expect(screen.getByText(/"amount": "120000000"/)).toBeInTheDocument()
  })

  it("verifies the signature against the JWKS", async () => {
    const user = userEvent.setup()
    renderWithProviders(<VerdictPanel jwt={jwt} />)
    await verify(user)

    const valid = await within(result()).findByText(/Signature valid/)
    expect(valid).toHaveTextContent(
      `Signature valid · key ${truncateMiddle(kid)} · ES256`,
    )
    expect(valid.closest("[aria-live]")).toHaveAttribute("aria-live", "polite")
  })

  it("fails verification after tampering, and passes again when undone", async () => {
    const user = userEvent.setup()
    renderWithProviders(<VerdictPanel jwt={jwt} />)
    await verify(user)
    await within(result()).findByText(/Signature valid/)

    const tamper = screen.getByRole("switch", { name: "Tamper with payload" })
    await user.click(tamper)
    // The old result is cleared, and the changed claim is tagged in text
    expect(within(result()).queryByText(/Signature valid/)).toBeNull()
    expect(screen.getByText(/"outcome": "allow"/)).toBeInTheDocument()
    expect(screen.getByText('changed, was "deny"')).toBeInTheDocument()

    await verify(user)
    expect(
      await within(result()).findByText(
        "Signature invalid: payload does not match signature",
      ),
    ).toBeInTheDocument()

    await user.click(tamper)
    expect(screen.getByText(/"outcome": "deny"/)).toBeInTheDocument()
    await verify(user)
    expect(
      await within(result()).findByText(/Signature valid/),
    ).toBeInTheDocument()
  })

  it("explains a key that isn't in the key set", async () => {
    // As if the verdict came from an earlier page load
    const otherLoad = await createVerdictKey()
    server.use(
      http.get("*/api/jwks", () =>
        Response.json(jwksResponse.encode({ keys: [otherLoad.publicJwk] })),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<VerdictPanel jwt={jwt} />)
    await verify(user)

    expect(
      await within(result()).findByText(/^Signature invalid: unknown key/),
    ).toBeInTheDocument()
  })

  it("offers Retry when the keys can't be loaded", async () => {
    server.use(
      http.get(
        "*/api/jwks",
        () =>
          Response.json({ code: "NOT_FOUND", message: "x" }, { status: 500 }),
        { once: true },
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<VerdictPanel jwt={jwt} />)

    await user.click(await screen.findByRole("button", { name: "Retry" }))
    await verify(user)
    expect(
      await within(result()).findByText(/Signature valid/),
    ).toBeInTheDocument()
  })
})
