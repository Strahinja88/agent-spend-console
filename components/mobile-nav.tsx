"use client"

import { Menu } from "lucide-react"
import { useState } from "react"

import { MainNav } from "@/components/main-nav"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation"
        >
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetHeader>
          <SheetTitle>Agent Spend Console</SheetTitle>
        </SheetHeader>
        <MainNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
