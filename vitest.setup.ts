import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// jsdom has no pointer capture or scrollIntoView; sonner (toast clicks) and
// Radix Select call them.
if (typeof Element !== "undefined") {
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.scrollIntoView ??= () => {}
}

afterEach(() => {
  cleanup()
})
