import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { AppShell } from "@/components/app-shell"
import { MockReady } from "@/components/mock-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"
import { Providers } from "./providers"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "Agent Spend Console",
    template: "%s · Agent Spend Console",
  },
  description:
    "Demo finance console for AI-agent payments: approvals, signed verdicts and testnet payment tracking.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // next-themes sets the theme class on <html> before hydration
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider>
          <TooltipProvider>
            {/* Around the shell, not just the page: the sidebar reads the approvals query */}
            <Providers>
              <AppShell>
                <MockReady>{children}</MockReady>
              </AppShell>
            </Providers>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
