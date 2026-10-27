"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

import { MockProvider } from "@/components/mock-provider"
import { Toaster } from "@/components/ui/sonner"
import { isNotFound } from "@/lib/api/client"

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
    <MockProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster position="bottom-right" />
      </QueryClientProvider>
    </MockProvider>
  )
}
