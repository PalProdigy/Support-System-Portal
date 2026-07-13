'use client'

import dynamic from 'next/dynamic'
import { Suspense, useState } from 'react'
import { useSession } from '@/lib/auth/context'
import { canAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { Wrench, ClipboardList, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

function ListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
      </div>
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
      </div>
    </div>
  )
}

// "My Cases" — merges what used to be the separate /cases page (search,
// filters, KPI overview, pagination) with this hub's assigned-cases list,
// so a support engineer has one organized workspace instead of two
// overlapping pages.
const MyCases = dynamic(
  () => import('@/modules/engineer/my-cases').then((m) => m.MyCases),
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
    <div className="p-6 space-y-6">
      <Guard />
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Wrench className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Cases</h1>
          <p className="text-sm text-muted-foreground">Every case assigned to you, and how you're performing</p>
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
        {tab === 'cases'       && <MyCases />}
        {tab === 'performance' && <PerformanceDashboard />}
      </Suspense>
    </div>
  )
}
