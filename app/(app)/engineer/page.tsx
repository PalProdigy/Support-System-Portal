'use client'

import dynamic from 'next/dynamic'
import { Suspense, useState } from 'react'
import { useSession } from '@/lib/auth/context'
import { canAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { Wrench, ClipboardList, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

function ListSkeleton() {
  return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
}

const AssignedCases = dynamic(
  () => import('@/modules/engineer/assigned-cases').then((m) => m.AssignedCases),
  { loading: () => <ListSkeleton /> }
)
const PerformanceDashboard = dynamic(
  () => import('@/modules/engineer/performance-dashboard').then((m) => m.PerformanceDashboard),
  { loading: () => <ListSkeleton /> }
)

function Guard() {
  const session = useSession()
  const scope = { userId: session.userId, role: session.role }
  if (!canAccess(scope, 'resolve', 'case')) redirect('/dashboard')
  return null
}

type Tab = 'cases' | 'performance'

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'cases',       label: 'My Cases',       icon: ClipboardList },
  { key: 'performance', label: 'My Performance', icon: TrendingUp    },
]

export default function EngineerHubPage() {
  const [tab, setTab] = useState<Tab>('cases')

  return (
    <div className="space-y-6">
      <Guard />
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Wrench className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Engineer Hub</h1>
          <p className="text-sm text-muted-foreground">Your assigned cases and performance metrics</p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <Suspense fallback={<ListSkeleton />}>
        {tab === 'cases'       && <AssignedCases />}
        {tab === 'performance' && <PerformanceDashboard />}
      </Suspense>
    </div>
  )
}
