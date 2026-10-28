import { http } from "msw"

import { handleApiRequest, hasRoute } from "./api"

// MSW is for tests only (D-025): it puts the mock API (mocks/api.ts) behind
// real fetch calls, so tests can log requests and override single routes.
// "*" matches any origin; tests resolve paths against http://localhost.
// Unknown routes fall through, so `onUnhandledFrame: "error"` still flags them.

export const handlers = [
  http.all("*/api/*", ({ request }) =>
    hasRoute(request.method, new URL(request.url).pathname)
      ? handleApiRequest(request)
      : undefined,
  ),
]
