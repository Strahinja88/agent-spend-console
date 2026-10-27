import { setupWorker } from "msw/browser"

import { handlers } from "./handlers"

/** MSW in the browser. Started from the app in phase 3. */
export const worker = setupWorker(...handlers)
