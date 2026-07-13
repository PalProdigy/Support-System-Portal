
'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth/context'
import { Toaster } from '@/components/ui/toaster'
import NHQLoader from '@/components/NHQLoader/page'

// One-time branded boot splash — shown for a fixed 3s on every fresh page
// load (hard refresh / first visit). `Providers` lives in the root layout,
// which persists across client-side navigations, so this state is only
// ever initialized once per real page load, not on every route change.
// The app tree mounts immediately underneath so data fetching (react-query,
// auth) starts right away instead of waiting for the splash to finish.
const BOOT_SPLASH_DURATION_MS = 3000

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )
  const [booting, setBooting] = useState(true)

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster />
      </AuthProvider>
      {booting && (
        <NHQLoader duration={BOOT_SPLASH_DURATION_MS} onComplete={() => setBooting(false)} />
      )}
    </QueryClientProvider>
  )
}