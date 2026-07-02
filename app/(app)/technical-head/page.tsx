'use client'

import { Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { redirect } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ShieldAlert, LayoutList, AlertTriangle, ShieldCheck, BarChart3, TrendingUp } from 'lucide-react'

const OverviewBoard = dynamic(
  () => import('@/modules/technical-head/overview-board').then((m) => m.OverviewBoard),
  { loading: () => <ListSkeleton /> }
)
const EscalationQueue = dynamic(
  () => import('@/modules/technical-head/escalation-queue').then((m) => m.EscalationQueue),
  { loading: () => <ListSkeleton /> }
)
const CriticalApprovalQueue = dynamic(
  () => import('@/modules/technical-head/critical-approval-queue').then((m) => m.CriticalApprovalQueue),
  { loading: () => <ListSkeleton /> }
)
const WorkloadCharts = dynamic(
  () => import('@/modules/technical-head/workload-charts').then((m) => m.WorkloadCharts),
  { ssr: false, loading: () => <ListSkeleton /> }
)
const PerformanceOverview = dynamic(
  () => import('@/modules/technical-head/performance-overview').then((m) => m.PerformanceOverview),
  { loading: () => <ListSkeleton /> }
)

function ListSkeleton() {
  return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
}

type Tab = 'overview' | 'escalations' | 'approvals' | 'workload' | 'performance'

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'overview',     label: 'All Cases',        icon: LayoutList    },
  { key: 'escalations',  label: 'Escalations',      icon: AlertTriangle },
  { key: 'approvals',    label: 'Critical Approval', icon: ShieldCheck  },
  { key: 'workload',     label: 'Workload',          icon: BarChart3    },
  { key: 'performance',  label: 'Performance',       icon: TrendingUp   },
]

function Guard() {
  const session = useSession()
  if (session.role !== 'technical_head') redirect('/dashboard')
  return null
}

function THHeader() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesPage } = useQuery({
    queryKey: ['cases', 'all-teams'],
    queryFn: () => dp.listCases(scope, { pageSize: 500 }),
  })
  const { data: notifications } = useQuery({
    queryKey: ['notifications', session.userId],
    queryFn: () => dp.listNotifications(session.userId),
  })

  const escalatedCount       = (casesPage?.items ?? []).filter((c) => c.is_escalated || c.status === 'escalated').length
  const criticalPending      = (casesPage?.items ?? []).filter((c) => c.priority === 'critical' && ['resolved', 'pending_closure'].includes(c.status) && !c.th_approved).length
  const slaNotifCount        = (notifications ?? []).filter((n) => !n.read_at && ['sla_at_risk', 'sla_breached', 'case_auto_escalated'].includes(n.type)).length

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="rounded-xl bg-red-100 dark:bg-red-900/30 p-2.5">
        <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">TH Hub</h1>
        <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
          Technical Head oversight — all teams
          {escalatedCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold">
              <AlertTriangle className="h-2.5 w-2.5" /> {escalatedCount} escalated
            </span>
          )}
          {criticalPending > 0 && (
            <span className="inline-flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">
              <ShieldCheck className="h-2.5 w-2.5" /> {criticalPending} need approval
            </span>
          )}
          {slaNotifCount > 0 && (
            <span className="inline-flex text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-full font-semibold">
              {slaNotifCount} SLA alerts
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

export default function THHubPage() {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <div className="space-y-6 p-6">
      <Guard />
      <THHeader />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
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
        {tab === 'overview'     && <OverviewBoard />}
        {tab === 'escalations'  && <EscalationQueue />}
        {tab === 'approvals'    && <CriticalApprovalQueue />}
        {tab === 'workload'     && <WorkloadCharts />}
        {tab === 'performance'  && <PerformanceOverview />}
      </Suspense>
    </div>
  )
}
