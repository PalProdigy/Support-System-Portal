'use client'

import { Suspense, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { redirect, useRouter, useSearchParams } from 'next/navigation'
import { cn, slaRemainingMs } from '@/lib/utils'
import { StatCard } from '@/components/shared/stat-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  ShieldAlert, LayoutList, AlertTriangle, ShieldCheck, BarChart3, TrendingUp,
  Ticket, UserX, Gauge, Search, Loader2,
} from 'lucide-react'
import type { EngineerMetrics } from '@/types'

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

// One KPI card per hub tab (plus SLA Breached as a cross-cutting urgency
// signal) so the snapshot is visible no matter which tab is active, and each
// card jumps straight to the tab it summarizes.
function THHeader({
  tab, search, onSearchChange, isSearching, onSearch,
}: {
  tab: Tab
  search: string
  onSearchChange: (value: string) => void
  isSearching: boolean
  onSearch: () => void
}) {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesPage, isLoading: casesLoading } = useQuery({
    queryKey: ['cases', 'all-teams'],
    queryFn: () => dp.listCases(scope, { pageSize: 500 }),
  })
  // Shared query key with PerformanceOverview — warms its cache too.
  const { data: metrics } = useQuery<EngineerMetrics[]>({
    queryKey: ['all-engineer-metrics'],
    queryFn: () => dp.listAllEngineerMetrics(scope),
    staleTime: 30_000,
  })

  const cases = useMemo(() => casesPage?.items ?? [], [casesPage])
  const OPEN_STATUSES = useMemo(() => new Set(['new', 'triaged', 'assigned', 'in_progress', 'pending_client', 'escalated']), [])

  const openCount = useMemo(() => cases.filter((c) => OPEN_STATUSES.has(c.status)).length, [cases, OPEN_STATUSES])
  const escalatedCount = useMemo(() => cases.filter((c) => c.is_escalated || c.status === 'escalated').length, [cases])
  const slaBreachedCount = useMemo(
    () => cases.filter((c) => OPEN_STATUSES.has(c.status) && slaRemainingMs(c.sla_due_at) < 0).length,
    [cases, OPEN_STATUSES]
  )
  const pendingApprovalCount = useMemo(
    () => cases.filter((c) => c.priority === 'critical' && ['resolved', 'pending_closure'].includes(c.status) && !c.th_approved).length,
    [cases]
  )
  const unassignedCount = useMemo(() => cases.filter((c) => OPEN_STATUSES.has(c.status) && !c.assignee_id).length, [cases, OPEN_STATUSES])
  const avgSLA = useMemo(() => {
    if (!metrics?.length) return null
    return Math.round(metrics.reduce((s, m) => s + m.sla_compliance_pct, 0) / metrics.length)
  }, [metrics])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-red-100 dark:bg-red-900/30 p-2.5">
            <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">TH Hub</h1>
            <p className="text-sm text-muted-foreground">Technical Head oversight — all teams</p>
          </div>
        </div>

        {tab === 'overview' && (
          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder="Search cases…"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              />
            </div>
            <Button type="button" size="sm" onClick={onSearch} disabled={isSearching} className="h-8 shrink-0">
              {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white" /> : <Search className="h-3.5 w-3.5 text-white" />}
              <span className="text-white">Search</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

const TAB_KEYS = TABS.map((t) => t.key)

function isTab(value: string | null): value is Tab {
  return value != null && (TAB_KEYS as string[]).includes(value)
}

function THHubContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Deep-linkable tabs: /technical-head?tab=approvals opens Critical Approval, etc.
  const tabParam = searchParams.get('tab')
  const tab: Tab = isTab(tabParam) ? tabParam : 'overview'

  const selectTab = (key: Tab) => {
    router.replace(`/technical-head?tab=${key}`, { scroll: false })
  }

  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  async function runSearch() {
    if (isSearching) return
    setIsSearching(true)
    await new Promise((resolve) => setTimeout(resolve, 450))
    setQuery(search)
    setIsSearching(false)
  }

  return (
    <div className="space-y-6 p-6">
      <Guard />
      <THHeader tab={tab} search={search} onSearchChange={setSearch} isSearching={isSearching} onSearch={runSearch} />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => selectTab(key)}
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
        {tab === 'overview'     && <OverviewBoard query={query} />}
        {tab === 'escalations'  && <EscalationQueue />}
        {tab === 'approvals'    && <CriticalApprovalQueue />}
        {tab === 'workload'     && <WorkloadCharts />}
        {tab === 'performance'  && <PerformanceOverview />}
      </Suspense>
    </div>
  )
}

export default function THHubPage() {
  // useSearchParams must live under a Suspense boundary.
  return (
    <Suspense fallback={<div className="p-6"><ListSkeleton /></div>}>
      <THHubContent />
    </Suspense>
  )
}
