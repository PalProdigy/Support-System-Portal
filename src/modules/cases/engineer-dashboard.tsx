'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { StatCard } from '@/components/shared/stat-card'
import { CaseCard } from '@/components/shared/case-card'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { NewCases } from '@/modules/engineer/new-cases'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  cn, slaRemainingMs, slaPercent, formatDuration, PRIORITY_COLORS, PRIORITY_LABELS,
} from '@/lib/utils'
import {
  Ticket, LayoutList, CheckCircle, Gauge, Clock, Star,
  Wrench, TrendingUp, ArrowRight, Inbox, Award, Briefcase,
} from 'lucide-react'
import type { Case, Client, EngineerMetrics, CertificationLevel } from '@/types'

const OPEN_EXCLUDE = ['closed', 'resolved', 'pending_closure']
const DONE_STATUSES = ['resolved', 'pending_closure', 'closed']

// Colour tiers for the certification level badge (L1 junior → L5 expert) —
// mirrors the palette used on the staff profile page for visual consistency.
const CERT_COLORS: Record<CertificationLevel, string> = {
  L1: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-600',
  L2: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-700',
  L3: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/40 dark:text-violet-400 dark:border-violet-700',
  L4: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700',
  L5: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-700',
}
const CERT_LABELS: Record<CertificationLevel, string> = {
  L1: 'Foundation', L2: 'Associate', L3: 'Professional', L4: 'Senior', L5: 'Expert',
}

export default function EngineerDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesData, isLoading, error, refetch } = useQuery({
    queryKey: ['cases', 'engineer', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 200 }),
    refetchInterval: 60_000,
  })
  const { data: clients } = useQuery({ queryKey: ['clients', session.userId], queryFn: () => dp.listClients(scope) })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
  const { data: notifications } = useQuery({ queryKey: ['notifications', session.userId], queryFn: () => dp.listNotifications(session.userId) })
  const { data: metrics, isLoading: metricsLoading } = useQuery<EngineerMetrics>({
    queryKey: ['engineer-metrics', session.userId],
    queryFn: () => dp.getEngineerMetrics(session.userId, scope),
    staleTime: 30_000,
  })
  const [nowMs] = useState(() => Date.now())

  const cases = casesData?.items ?? []
  const clientsMap = Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c]))

  const myUser = (users ?? []).find((u) => u.id === session.userId)
  const myTeam = (teams ?? []).find((t) => t.id === myUser?.team_id)
  const teamLead = (users ?? []).find((u) => u.id === myTeam?.lead_user_id)

  // ── Case buckets ───────────────────────────────────────────────────────────
  const open = cases.filter((c: Case) => !OPEN_EXCLUDE.includes(c.status))
  const inProgress = cases.filter((c: Case) => c.status === 'in_progress')
  const pendingClient = cases.filter((c: Case) => c.status === 'pending_client')
  const resolved = cases.filter((c: Case) => DONE_STATUSES.includes(c.status))

  const sortedOpen = [...open].sort((a, b) => slaRemainingMs(a.sla_due_at) - slaRemainingMs(b.sla_due_at))

  // SLA risk among open cases.
  const breached = open.filter((c) => slaRemainingMs(c.sla_due_at) <= 0)
  const atRisk = open.filter((c) => slaRemainingMs(c.sla_due_at) > 0 && slaPercent(c.created_at, c.sla_due_at) >= 80)
  const slaRisk = [...breached, ...atRisk].sort((a, b) => slaRemainingMs(a.sla_due_at) - slaRemainingMs(b.sla_due_at))

  const unreadCount = (notifications ?? []).filter((n) => !n.read_at).length

  // Last month / last 3 months summary
  const oneMonthAgoMs = nowMs - 30 * 24 * 3_600_000
  const threeMonthsAgoMs = nowMs - 90 * 24 * 3_600_000
  const solvedLastMonth = cases.filter((c) => c.resolved_at && new Date(c.resolved_at).getTime() >= oneMonthAgoMs).length
  const dueLast3Months = cases.filter((c) => {
    const dueMs = new Date(c.sla_due_at).getTime()
    return dueMs >= threeMonthsAgoMs && dueMs <= nowMs
  }).length

  if (error) return <ErrorState onRetry={refetch} />

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Wrench className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Workspace</h1>
            <p className="text-sm text-muted-foreground">
              {myTeam ? myTeam.name : 'Support Engineer'}
              {teamLead && <> · Reporting to <span className="font-medium text-foreground">{teamLead.name}</span></>}
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
                  {unreadCount} new
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <StatLink href="/my-case"><StatCard title="Total Cases" value={cases.length} icon={Ticket} loading={isLoading} /></StatLink>
        <StatLink href="/my-case"><StatCard title="Open" value={open.length} icon={LayoutList} iconColor="text-blue-500" loading={isLoading} /></StatLink>
        <StatLink href="/my-case">
          <StatCard title="Last Month — Solved" value={solvedLastMonth} icon={CheckCircle} iconColor="text-emerald-500" loading={isLoading} />
        </StatLink>
        <StatLink href="/my-case">
          <StatCard title="Last 3 Months — Due" value={dueLast3Months} icon={Clock} iconColor="text-amber-500" loading={isLoading} />
        </StatLink>
        <StatLink href="/my-case">
          <StatCard
            title="Customer Satisfaction"
            value={metrics?.satisfaction_score != null ? `${metrics.satisfaction_score}/5` : '—/5'}
            icon={Star}
            iconColor={metrics?.satisfaction_score != null ? (metrics.satisfaction_score >= 4 ? 'text-emerald-500' : metrics.satisfaction_score >= 3 ? 'text-amber-500' : 'text-red-500') : 'text-muted-foreground'}
            loading={metricsLoading}
          />
        </StatLink>
        <StatLink href="/profile"><CertificationCard level={myUser?.certification_level} years={myUser?.years_of_experience} /></StatLink>


      </div>

      {/* New cases available to claim */}
      <NewCases clientsMap={clientsMap} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Cases */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold">My Cases</h2>
            <span className="text-xs text-muted-foreground">Sorted by SLA urgency</span>
          </div>
          <Tabs defaultValue="open">
            <TabsList>
              <TabsTrigger value="open">Open ({open.length})</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress ({inProgress.length})</TabsTrigger>
              <TabsTrigger value="pending_client">Pending Client ({pendingClient.length})</TabsTrigger>
              <TabsTrigger value="resolved">Resolved ({resolved.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="open" className="mt-4">
              <CaseList
                cases={sortedOpen} clientsMap={clientsMap}
                empty={<EmptyState icon={CheckCircle} title="All caught up!" description="No open cases assigned to you." />}
              />
            </TabsContent>
            <TabsContent value="in_progress" className="mt-4">
              <CaseList cases={inProgress} clientsMap={clientsMap}
                empty={<EmptyState icon={Clock} title="Nothing in progress" description="Cases you're actively working will appear here." />} />
            </TabsContent>
            <TabsContent value="pending_client" className="mt-4">
              <CaseList cases={pendingClient} clientsMap={clientsMap}
                empty={<EmptyState icon={Inbox} title="Nothing pending client" description="Cases waiting on a client reply will appear here." />} />
            </TabsContent>
            <TabsContent value="resolved" className="mt-4">
              <CaseList cases={resolved} clientsMap={clientsMap}
                empty={<EmptyState icon={CheckCircle} title="No resolved cases yet" description="Cases you've resolved or closed will appear here." />} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          {/* My performance */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">My Performance</h3>
              </div>
              <Link href="/my-case" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                Details <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {metricsLoading ? (
              <div className="grid grid-cols-2 gap-2.5">
                {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : metrics ? (
              <div className="grid grid-cols-2 gap-2.5">
                <PerfTile icon={<Gauge className="h-3.5 w-3.5 text-emerald-500" />} label="SLA Compliance" value={`${metrics.sla_compliance_pct}%`} />
                <PerfTile icon={<Clock className="h-3.5 w-3.5 text-blue-400" />} label="Avg Resolution" value={metrics.avg_resolution_hours != null ? `${metrics.avg_resolution_hours}h` : '—'} />
                <PerfTile icon={<Star className="h-3.5 w-3.5 text-amber-400" />} label="Satisfaction" value={metrics.satisfaction_score != null ? `${metrics.satisfaction_score}/5` : '—'} />
                <PerfTile icon={<CheckCircle className="h-3.5 w-3.5 text-emerald-500" />} label="Resolved" value={String(metrics.total_resolved)} />
              </div>
            ) : null}
          </div>

          {/* SLA risk */}
          <div id="sla-risk" className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/10 p-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Gauge className="h-4 w-4 text-amber-500 shrink-0" />
              <h3 className="text-sm font-semibold">SLA Risk</h3>
              <span className="text-[11px] text-muted-foreground">{breached.length} breached · {atRisk.length} at-risk</span>
            </div>
            {slaRisk.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">All your open cases are comfortably within SLA.</p>
            ) : (
              <ScrollArea className="max-h-[280px] pr-2">
                <div className="space-y-2">
                  {slaRisk.slice(0, 8).map((c) => {
                    const remaining = slaRemainingMs(c.sla_due_at)
                    const over = remaining <= 0
                    return (
                      <Link key={c.id} href={`/cases/${c.id}`} className="flex items-center gap-3 rounded-lg border bg-card p-2.5 hover:bg-accent/40 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-muted-foreground">{c.reference_no}</span>
                            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', PRIORITY_COLORS[c.priority])}>{PRIORITY_LABELS[c.priority]}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                        </div>
                        <span className={cn('text-[11px] font-semibold shrink-0', over ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>
                          {over ? 'Breached' : `${formatDuration(remaining)} left`}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CaseList({ cases, clientsMap, empty }: {
  cases: Case[]
  clientsMap: Record<string, Client>
  empty: React.ReactNode
}) {
  return (
    <ScrollArea className="h-[440px] pr-2">
      <div className="space-y-3">
        {cases.length === 0 ? empty : cases.map((c) => (
          <CaseCard key={c.id} case_={c} client={clientsMap[c.client_id]} href={`/cases/${c.id}`} />
        ))}
      </div>
    </ScrollArea>
  )
}

function PerfTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon}<span className="truncate">{label}</span></div>
      <p className="text-lg font-bold text-foreground leading-none tabular-nums">{value}</p>
    </div>
  )
}

function StatLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {children}
    </Link>
  )
}

function CertificationCard({ level, years }: { level?: CertificationLevel; years?: number }) {
  return (
    <div className="h-full rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex h-full items-start justify-between gap-3">
        <div className="flex-1 min-w-0 flex flex-col">
          <p className="text-sm font-medium text-muted-foreground">Certification</p>
          <div className="mt-1.5">
            {level ? (
              <Badge variant="outline" className={cn('font-mono font-bold gap-1', CERT_COLORS[level])}>
                <Award className="h-3 w-3" /> {level}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Briefcase className="h-3 w-3" /> Uncertified
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground leading-snug">
            {level ? CERT_LABELS[level] : 'Not yet certified'}
            {years != null && ` · ${years} yr${years === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
          <Award className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  )
}
