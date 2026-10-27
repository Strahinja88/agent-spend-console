"use client"

import { createContext, useContext } from "react"

/**
 * False while the mock API is still starting in the browser, so queries wait
 * instead of hitting a network with no handlers. Defaults to true, so tests
 * and anything rendered outside MockProvider can fetch straight away.
 */
export const ApiReadyContext = createContext(true)

export function useApiReady(): boolean {
  return useContext(ApiReadyContext)
}
