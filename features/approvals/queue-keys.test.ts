import { describe, expect, it } from "vitest"

import { shortcutFor } from "./queue-keys"

function key(
  k: string,
  {
    target = document.body,
    ctrlKey = false,
    altKey = false,
    metaKey = false,
  }: {
    target?: Element
    ctrlKey?: boolean
    altKey?: boolean
    metaKey?: boolean
  } = {},
) {
  return { key: k, target, ctrlKey, altKey, metaKey }
}

function inside(html: string, selector: string): Element {
  const root = document.createElement("div")
  root.innerHTML = html
  return root.querySelector(selector)!
}

describe("shortcutFor", () => {
  it("maps the queue keys", () => {
    expect(shortcutFor(key("j"), true)).toBe("next")
    expect(shortcutFor(key("k"), true)).toBe("previous")
    expect(shortcutFor(key("a"), true)).toBe("approve")
    expect(shortcutFor(key("r"), true)).toBe("reject")
    expect(shortcutFor(key("?"), true)).toBe("help")
    expect(shortcutFor(key("Escape"), true)).toBe("escape")
    expect(shortcutFor(key("x"), true)).toBeNull()
  })

  it("ignores keys with Ctrl, Alt or Meta", () => {
    expect(shortcutFor(key("a", { ctrlKey: true }), true)).toBeNull()
    expect(shortcutFor(key("a", { altKey: true }), true)).toBeNull()
    expect(shortcutFor(key("a", { metaKey: true }), true)).toBeNull()
  })

  it("ignores character keys while typing, but not Esc", () => {
    for (const html of [
      "<input />",
      "<textarea></textarea>",
      "<select></select>",
      "<div contenteditable='true'></div>",
    ]) {
      const target = inside(html, "input, textarea, select, div")
      expect(shortcutFor(key("a", { target }), true)).toBeNull()
    }
    const textarea = inside("<textarea></textarea>", "textarea")
    expect(shortcutFor(key("Escape", { target: textarea }), true)).toBe(
      "escape",
    )
  })

  it("leaves every key to an open dialog", () => {
    const target = inside(
      "<div role='alertdialog'><button></button></div>",
      "button",
    )
    expect(shortcutFor(key("a", { target }), true)).toBeNull()
    expect(shortcutFor(key("Escape", { target }), true)).toBeNull()
  })

  it("turns every character key off, ? included, when shortcuts are off", () => {
    for (const k of ["j", "k", "a", "r", "?"]) {
      expect(shortcutFor(key(k), false)).toBeNull()
    }
    expect(shortcutFor(key("Escape"), false)).toBe("escape")
  })
})
