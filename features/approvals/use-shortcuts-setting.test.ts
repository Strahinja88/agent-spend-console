import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  SHORTCUTS_STORAGE_KEY,
  useShortcutsSetting,
} from "./use-shortcuts-setting"

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe("useShortcutsSetting", () => {
  it("defaults to on", () => {
    const { result } = renderHook(() => useShortcutsSetting())
    expect(result.current[0]).toBe(true)
  })

  it("reads a stored 'false' after mount and persists changes", async () => {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, "false")
    const { result } = renderHook(() => useShortcutsSetting())
    await waitFor(() => expect(result.current[0]).toBe(false))

    act(() => result.current[1](true))
    expect(result.current[0]).toBe(true)
    expect(localStorage.getItem(SHORTCUTS_STORAGE_KEY)).toBe("true")
  })

  it("falls back to memory when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    const { result } = renderHook(() => useShortcutsSetting())
    expect(result.current[0]).toBe(true)

    act(() => result.current[1](false))
    expect(result.current[0]).toBe(false)
  })
})
