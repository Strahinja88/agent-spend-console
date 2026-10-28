"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

import { Toaster } from "@/components/ui/sonner"
import { isNotFound } from "@/lib/api/client"
import { installMockApi } from "@/lib/api/mock-transport"

// The mock API is the demo's only backend, so it runs in every build,
// production included (D-011). Installed before any query can run (D-025).
installMockApi()

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Once, but never a 404: asking again won't make it appear
            retry: (count, error) => !isNotFound(error) && count < 1,
          },
          // Mutations roll back and offer Retry themselves
          mutations: { retry: false },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  )
}
