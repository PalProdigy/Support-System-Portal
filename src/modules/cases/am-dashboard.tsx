'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { cn } from '@/lib/utils'
import { StatCard } from '@/components/shared/stat-card'
import { SLABreachWidget } from '@/components/shared/sla-breach-widget'
import { CaseCard } from '@/components/shared/case-card'
import { CertificationCard } from '@/components/shared/certification-card'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { RecentActivity, type ActivityItem } from '@/components/shared/recent-activity'
import { Button } from '@/components/ui/button'
import {
  Ticket, Building2, CheckCircle2, AlertTriangle, PlusCircle, Target,
  Trophy, RefreshCcw, Briefcase, TrendingUp,
} from 'lucide-react'
import type { Case, Client, Prospect, ProspectStage } from '@/types'

const STAGE_LABELS: Record<ProspectStage, string> = {
  discovery: 'Discovery',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

function fmtCurrency(n: number) {
  return n >= 1_000_000 ? `৳${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `৳${(n / 1_000).toFixed(0)}K` : `৳${n}`
}

export default function AMDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesData, isLoading: casesLoading, error, refetch } = useQuery({
    queryKey: ['cases', 'am', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 50 }),
  })

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
  })

  const { data: prospects } = useQuery({
    queryKey: ['prospects', session.userId],
    queryFn: () => dp.listProspects(scope),
  })

  const { data: myUser } = useQuery({
    queryKey: ['user', session.userId],
    queryFn: () => dp.getUser(session.userId),
  })

  const cases = useMemo(() => casesData?.items ?? [], [casesData])
  const clientList: Client[] = useMemo(() => clients ?? [], [clients])
  const prospectList: Prospect[] = useMemo(() => prospects ?? [], [prospects])
  const clientsMap = Object.fromEntries(clientList.map((c) => [c.id, c]))

  const open = cases.filter((c: Case) => !['closed', 'resolved', 'pending_closure'].includes(c.status))

  // Performance metrics — sales-executive KPIs: pipeline conversion (win rate,
  // deals won, open pipeline value) plus account-management quality (case
  // resolution rate across their clients' cases).
  const wonDeals = prospectList.filter((p) => p.stage === 'closed_won')
  const lostDeals = prospectList.filter((p) => p.stage === 'closed_lost')
  const closedDeals = wonDeals.length + lostDeals.length
  const winRatePct = closedDeals > 0 ? Math.round((wonDeals.length / closedDeals) * 100) : null
  const openPipelineValue = prospectList
    .filter((p) => !['closed_won', 'closed_lost'].includes(p.stage))
    .reduce((sum, p) => sum + (p.estimated_value ?? 0), 0)
  const resolvedCases = cases.filter((c: Case) => ['resolved', 'closed'].includes(c.status))
  const resolutionRatePct = cases.length > 0 ? Math.round((resolvedCases.length / cases.length) * 100) : null

  // Last month's conversion — successful sales (deals won) closed in the
  // previous calendar month, and the win rate among everything decided that month.
  const now = new Date()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const closedLastMonth = prospectList.filter((p) => {
    if (p.stage !== 'closed_won' && p.stage !== 'closed_lost') return false
    const d = new Date(p.updated_at)
    return d >= lastMonthStart && d < thisMonthStart
  })
  const wonLastMonth = closedLastMonth.filter((p) => p.stage === 'closed_won')
  const lastMonthConversionPct = closedLastMonth.length > 0 ? Math.round((wonLastMonth.length / closedLastMonth.length) * 100) : null

  // Recent activity — synthesized from the AM's own cases, clients, and
  // pipeline (all already scope-filtered by the data provider), so it never
  // needs audit-log access the sales_executive role isn't granted.
  const activityItems: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = []

    for (const c of cases) {
      const client = clientsMap[c.client_id]
      const description = [c.reference_no, client?.company_name].filter(Boolean).join(' · ')
      items.push({
        id: `${c.id}-created`, icon: PlusCircle,
        iconColor: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-900/30',
        title: 'New case opened', description, timestamp: c.created_at, href: `/cases/${c.id}`,
      })
      const doneAt = c.closed_at ?? c.resolved_at
      if (doneAt) {
        items.push({
          id: `${c.id}-resolved`, icon: CheckCircle2,
          iconColor: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
          title: c.status === 'closed' ? 'Case closed' : 'Case resolved', description, timestamp: doneAt, href: `/cases/${c.id}`,
        })
      }
      if (c.is_escalated) {
        items.push({
          id: `${c.id}-escalated`, icon: AlertTriangle,
          iconColor: 'text-red-600 dark:text-red-400', iconBg: 'bg-red-100 dark:bg-red-900/30',
          title: 'Case escalated', description, timestamp: c.approval_escalated_at ?? c.created_at, href: `/cases/${c.id}`,
        })
      }
    }

    for (const cl of clientList) {
      items.push({
        id: `${cl.id}-added`, icon: Building2,
        iconColor: 'text-cyan-600 dark:text-cyan-400', iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
        title: 'New client onboarded', description: cl.company_name, timestamp: cl.created_at, href: `/clients/${cl.id}`,
      })
    }

    for (const p of prospectList) {
      items.push({
        id: `${p.id}-added`, icon: Target,
        iconColor: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-100 dark:bg-amber-900/30',
        title: 'New prospect added', description: p.company_name, timestamp: p.created_at,
      })
      if (p.updated_at !== p.created_at) {
        const won = p.stage === 'closed_won'
        const lost = p.stage === 'closed_lost'
        items.push({
          id: `${p.id}-updated`,
          icon: won ? Trophy : lost ? AlertTriangle : RefreshCcw,
          iconColor: won ? 'text-emerald-600 dark:text-emerald-400' : lost ? 'text-red-600 dark:text-red-400' : 'text-violet-600 dark:text-violet-400',
          iconBg: won ? 'bg-emerald-100 dark:bg-emerald-900/30' : lost ? 'bg-red-100 dark:bg-red-900/30' : 'bg-violet-100 dark:bg-violet-900/30',
          title: won ? 'Deal won' : lost ? 'Deal lost' : 'Pipeline stage updated',
          description: `${p.company_name} · ${STAGE_LABELS[p.stage]}`,
          timestamp: p.updated_at,
        })
      }
    }

    return items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 25)
  }, [cases, clientList, prospectList, clientsMap])

  if (error) return <ErrorState onRetry={refetch} />

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1680px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Account Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your clients, cases, and pipeline at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push('/sales-executive')}>
            <Briefcase className="h-4 w-4" />
            Pipeline
          </Button>
          <Button onClick={() => router.push('/cases/new')}>
            <PlusCircle className="h-4 w-4" />
            New Case
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Total Clients" value={clientList.length} icon={Building2} loading={clientsLoading} />
        <StatCard title="Open Cases" value={open.length} icon={Ticket} loading={casesLoading} />
        <SLABreachWidget cases={cases} isLoading={casesLoading} onRefresh={() => refetch()} inline />
        <CertificationCard level={myUser?.certification_level} years={myUser?.years_of_experience} />
        <StatCard
          title="Monthly Conversion"
          value={lastMonthConversionPct !== null ? `${lastMonthConversionPct}%` : '—'}
          subtitle={`${wonLastMonth.length} won last month`}
          icon={TrendingUp}
        />
      </div>

      {/* Main layout: content (left) + activity rail (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        {/* Left column */}
        <div className="space-y-6 min-w-0">
          {/* Recent cases */}
          <div>
            <h2 className="text-base font-semibold mb-3">Recent Cases</h2>
            <div className="space-y-3">
              {cases.length === 0 ? (
                <EmptyState icon={Ticket} title="No cases" description="No cases for your clients yet." />
              ) : (
                cases.slice(0, 6).map((c: Case) => (
                  <CaseCard key={c.id} case_={c} client={clientsMap[c.client_id]} href={`/cases/${c.id}`} compact />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right column: performance summary + recent activity rail */}
        <div className="space-y-6 xl:sticky xl:top-6">
          {/* My Performance */}
          <div className="rounded-xl border bg-card shadow-sm p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              My Performance
            </h3>

            {/* Win rate */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Win Rate</span>
                <span className={cn(
                  'text-xs font-bold',
                  winRatePct === null ? 'text-muted-foreground'
                    : winRatePct >= 60 ? 'text-emerald-600' : winRatePct >= 30 ? 'text-amber-600' : 'text-red-600'
                )}>
                  {winRatePct !== null ? `${winRatePct}%` : '—'}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    winRatePct === null ? 'bg-muted-foreground/30'
                      : winRatePct >= 60 ? 'bg-emerald-500' : winRatePct >= 30 ? 'bg-amber-500' : 'bg-red-500'
                  )}
                  style={{ width: `${Math.min(winRatePct ?? 0, 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {closedDeals > 0 ? `${wonDeals.length} won of ${closedDeals} closed deals` : 'No closed deals yet'}
              </p>
            </div>

            {/* Metric rows */}
            <div className="divide-y">
              <div className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" />
                  Deals Won
                </span>
                <span className="text-sm font-semibold text-foreground tabular-nums">{wonDeals.length}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Target className="h-3.5 w-3.5 text-violet-500" />
                  Pipeline Value
                </span>
                <span className="text-sm font-semibold text-foreground tabular-nums">{fmtCurrency(openPipelineValue)}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Case Resolution
                </span>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {resolutionRatePct !== null ? `${resolutionRatePct}%` : '—'}
                </span>
              </div>
            </div>
          </div>

          <RecentActivity items={activityItems} isLoading={casesLoading || clientsLoading} height={560} />
        </div>
      </div>
    </div>
  )
}
