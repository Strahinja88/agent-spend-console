"use client"

import { useCallback, useEffect, useState } from "react"

export const SHORTCUTS_STORAGE_KEY = "asc:shortcuts-enabled"

/**
 * The Keyboard shortcuts on/off switch (design.md §7.2). Default on. Read after
 * mount so server and first client render match. Storage can throw (private
 * mode, blocked site data); then the setting just lives in memory.
 */
export function useShortcutsSetting(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    try {
      if (localStorage.getItem(SHORTCUTS_STORAGE_KEY) === "false") {
        setEnabled(false)
      }
    } catch {
      // Keep the in-memory default
    }
  }, [])

  const update = useCallback((next: boolean) => {
    setEnabled(next)
    try {
      localStorage.setItem(SHORTCUTS_STORAGE_KEY, String(next))
    } catch {
      // In-memory only for this session
    }
  }, [])

  return [enabled, update]
}
