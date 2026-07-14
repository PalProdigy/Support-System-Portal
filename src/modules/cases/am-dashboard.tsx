'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { StatCard } from '@/components/shared/stat-card'
import { SLABreachWidget } from '@/components/shared/sla-breach-widget'
import { CaseCard } from '@/components/shared/case-card'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { RecentActivity, type ActivityItem } from '@/components/shared/recent-activity'
import { Button } from '@/components/ui/button'
import {
  Ticket, Building2, CheckCircle2, AlertTriangle, PlusCircle, Target,
  TrendingUp, Trophy, RefreshCcw, Briefcase, ChevronRight,
} from 'lucide-react'
import type { Case, Client, Prospect, ProspectStage } from '@/types'

const STAGE_LABELS: Record<ProspectStage, string> = {
  discovery: 'Discovery',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

const STAGE_COLORS: Record<ProspectStage, string> = {
  discovery: '#3b82f6',
  proposal: '#8b5cf6',
  negotiation: '#f59e0b',
  closed_won: '#10b981',
  closed_lost: '#ef4444',
}

function fmtCurrency(n: number) {
  return n >= 1_000_000 ? `৳${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `৳${(n / 1_000).toFixed(0)}K` : `৳${n}`
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  )
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

  const cases = useMemo(() => casesData?.items ?? [], [casesData])
  const clientList: Client[] = useMemo(() => clients ?? [], [clients])
  const prospectList: Prospect[] = useMemo(() => prospects ?? [], [prospects])
  const clientsMap = Object.fromEntries(clientList.map((c) => [c.id, c]))

  const open = cases.filter((c: Case) => !['closed', 'resolved', 'pending_closure'].includes(c.status))
  const escalated = cases.filter((c: Case) => c.is_escalated)
  const resolved = cases.filter((c: Case) => ['resolved', 'closed'].includes(c.status))
  const openPipeline = prospectList.filter((p) => !['closed_won', 'closed_lost'].includes(p.stage))
  const pipelineValue = openPipeline.reduce((sum, p) => sum + (p.estimated_value ?? 0), 0)

  // Pipeline distribution — prospects grouped by stage.
  const pipelineData = useMemo(() => {
    const counts = new Map<ProspectStage, number>()
    prospectList.forEach((p) => counts.set(p.stage, (counts.get(p.stage) ?? 0) + 1))
    return Array.from(counts.entries())
      .map(([stage, value]) => ({ name: STAGE_LABELS[stage], value, color: STAGE_COLORS[stage] }))
      .filter((d) => d.value > 0)
  }, [prospectList])

  // Case activity trend — opened vs resolved, last 6 months.
  const caseTrend = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const monthIdx = d.getMonth()
      const year = d.getFullYear()
      return {
        name: d.toLocaleString('default', { month: 'short' }),
        Opened: cases.filter((c) => {
          const cd = new Date(c.created_at)
          return cd.getMonth() === monthIdx && cd.getFullYear() === year
        }).length,
        Resolved: cases.filter((c) => {
          const doneAt = c.closed_at ?? c.resolved_at
          if (!doneAt) return false
          const rd = new Date(doneAt)
          return rd.getMonth() === monthIdx && rd.getFullYear() === year
        }).length,
      }
    })
  }, [cases])

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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="My Clients" value={clientList.length} icon={Building2} loading={clientsLoading} />
        <StatCard
          title="Open Pipeline"
          value={openPipeline.length}
          icon={Target}
          iconColor="text-violet-500"
          subtitle={pipelineValue > 0 ? `${fmtCurrency(pipelineValue)} value` : undefined}
        />
        <StatCard title="Open Cases" value={open.length} icon={Ticket} loading={casesLoading} />
        <StatCard title="Escalated" value={escalated.length} icon={AlertTriangle} iconColor="text-amber-500" loading={casesLoading} />
        <StatCard title="Resolved" value={resolved.length} icon={CheckCircle2} iconColor="text-emerald-500" loading={casesLoading} />
      </div>

      {/* Main layout: content (left) + activity rail (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        {/* Left column */}
        <div className="space-y-6 min-w-0">
          {/* SLA health */}
          <SLABreachWidget cases={cases} isLoading={casesLoading} onRefresh={() => refetch()} />

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Pipeline Distribution
              </h3>
              {pipelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pipelineData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {pipelineData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-16">No prospects in your pipeline yet</p>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Case Activity (last 6 months)
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={caseTrend} barSize={14} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Opened" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Resolved" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Clients overview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Clients</h2>
              {clientList.length > 6 && (
                <Button variant="ghost" size="sm" onClick={() => router.push('/clients')}>
                  View all <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {clientsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
              </div>
            ) : clientList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {clientList.slice(0, 6).map((c) => {
                  const clientCases = cases.filter((x: Case) => x.client_id === c.id)
                  const openCount = clientCases.filter((x: Case) => !['closed', 'resolved'].includes(x.status)).length
                  return (
                    <div
                      key={c.id}
                      className="rounded-xl border bg-card p-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
                      onClick={() => router.push(`/clients/${c.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-foreground">{c.company_name}</p>
                        {c.account_tier && (
                          <span className="shrink-0 text-[10px] font-medium capitalize px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                            {c.account_tier}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.contact_person}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <span className={openCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}>{openCount} open</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{clientCases.length} total</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState icon={Building2} title="No clients yet" description="Clients assigned to you will appear here." size="sm" />
            )}
          </div>

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

        {/* Right column: recent activity rail */}
        <div className="xl:sticky xl:top-6">
          <RecentActivity items={activityItems} isLoading={casesLoading || clientsLoading} height={560} />
        </div>
      </div>
    </div>
  )
}
