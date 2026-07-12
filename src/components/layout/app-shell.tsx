'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { Skeleton } from '@/components/ui/skeleton'
import { getDataProvider } from '@/lib/data'
import { useState } from 'react'
import type { User } from '@/types'
import { SLAEngineProvider } from '@/lib/sla/provider'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { session, isLoading } = useAuth()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/login')
    }
  }, [session, isLoading, router])

  useEffect(() => {
    if (!session) return
    getDataProvider().getUser(session.userId).then(setCurrentUser).catch(() => {})
  }, [session])

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    )
  }

  if (!session) return null

  return (
    <SLAEngineProvider>
      {/* print: hide the app chrome and unlock the scroll containers so the
          full page content (e.g. a KB article) prints, not just one viewport */}
      <div className="flex h-screen overflow-hidden bg-background print:h-auto print:overflow-visible">

        <div className="contents print:hidden">
          <Sidebar
            userName={currentUser?.name ?? 'User'}
            userRole={session.role}
          />
        </div>
        <div className="relative flex-1 overflow-hidden min-w-0 print:overflow-visible">
          <div className="contents print:hidden">
            <Topbar userName={currentUser?.name ?? 'User'} />
          </div>
          <main className="absolute inset-0 overflow-y-auto pt-14 print:static print:overflow-visible print:pt-0">
            {children}
          </main>
        </div>
      </div>
    </SLAEngineProvider>
  )
}