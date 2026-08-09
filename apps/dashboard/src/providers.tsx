import { createTRPCReact } from '@trpc/react-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink, wsLink, createWSClient } from '@trpc/client'
import { useState } from 'react'
import superjson from 'superjson'
import type { AppRouter } from './lib/trpc-types'

export const trpc = createTRPCReact<AppRouter>()

function getApiUrl(): string {
  return import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
}

function getWsUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
  return apiUrl.replace(/^http/, 'ws')
}

import { SwarmErrorBoundary } from './components/error-boundary'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 1000,
        refetchInterval: 10 * 1000,
      },
    },
  }))

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getApiUrl()}/trpc`,
          transformer: superjson,
        }),
        wsLink({
          client: createWSClient({
            url: getWsUrl(),
          }),
          transformer: superjson,
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SwarmErrorBoundary>
          {children}
        </SwarmErrorBoundary>
      </QueryClientProvider>
    </trpc.Provider>
  )
}