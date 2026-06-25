'use client'

import { Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { canAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Users, LayoutList, Bell } from 'lucide-react'

const TeamQueue = dynamic(
  () => import('@/modules/lead/team-queue').then((m) => m.TeamQueue),
  { loading: () => <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div> }
)
const WorkloadContainer = dynamic(
  () => import('@/modules/lead/workload-container').then((m) => m.WorkloadContainer),
  { loading: () => <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}</div> }
)
const ActivityFeed = dynamic(
  () => import('@/modules/lead/activity-feed').then((m) => m.ActivityFeed),
  { loading: () => <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div> }
)
const ClosureQueue = dynamic(
  () => import('@/modules/lead/closure-queue').then((m) => m.ClosureQueue),
  { loading: () => <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}</div> }
)

type Tab = 'queue' | 'workload' | 'activity' | 'closure'

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'queue', label: 'Team Queue', icon: LayoutList },
  { key: 'workload', label: 'Workload', icon: Users },
  { key: 'closure', label: 'Closure Review', icon: Bell },
  { key: 'activity', label: 'Activity', icon: Bell },
]

function Guard() {
  const session = useSession()
  const scope = { userId: session.userId, role: session.role }
  if (!canAccess(scope, 'assign', 'case')) redirect('/dashboard')
  return null
}

function TeamHeader() {
  const session = useSession()
  const dp = getDataProvider()

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => dp.listUsers(),
  })
  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => dp.listTeams(),
  })
  const { data: notifications } = useQuery({
    queryKey: ['notifications', session.userId],
    queryFn: () => dp.listNotifications(session.userId),
  })

  const myUser = users?.find((u) => u.id === session.userId)
  const myTeam = teams?.find((t) => t.id === myUser?.team_id)
  const unreadCount = (notifications ?? []).filter(
    (n) => !n.read_at && ['new_case', 'case_escalated', 'client_replied'].includes(n.type)
  ).length

  return (
    <div className="flex items-center gap-3">
      <div className="rounded-xl bg-primary/10 p-2.5">
        <Users className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Lead Hub</h1>
        <p className="text-sm text-muted-foreground">
          {myTeam ? myTeam.name : 'Team queue, workload, and assignments'}
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
              {unreadCount} new
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

export default function LeadPage() {
  const [tab, setTab] = useState<Tab>('queue')

  return (
    <div className="space-y-6">
      <Guard />
      <TeamHeader />

      {/* Tabs */}
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

      {/* Tab content */}
      <Suspense fallback={<div className="h-64 rounded-xl bg-muted animate-pulse" />}>
        {tab === 'queue' && <TeamQueue />}
        {tab === 'workload' && <WorkloadContainer />}
        {tab === 'closure' && <ClosureQueue />}
        {tab === 'activity' && <ActivityFeed />}
      </Suspense>
    </div>
  )
}