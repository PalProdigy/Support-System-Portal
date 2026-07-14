'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { StatCard } from '@/components/shared/stat-card'
import { CaseCard } from '@/components/shared/case-card'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CaseApprovalQueue } from '@/modules/shared/case-approval-queue'
import { cn, formatDateTime } from '@/lib/utils'
import {
  Ticket, AlertTriangle, CheckCircle, CheckCircle2, Clock, Users, Gauge,
  ShieldCheck, ArrowLeftRight, UserPlus, BookOpen, Star, ChevronRight,
  Building2, Lightbulb, Package, Shield, TrendingDown, RotateCcw, TimerReset,
} from 'lucide-react'
import type { Case, User, Client, AuditLog, EngineerMetrics, Feedback, KBArticle, Notification, Team, CaseTransferRequest, TeamMemberRequest, SLARule } from '@/types'

// Recharts widget — client-only so it stays out of SSR.
const CaseSummary12m = dynamic(
  () => import('@/modules/technical-head/case-summary-12m').then((m) => m.CaseSummary12m),
  { ssr: false, loading: () => <div className="h-[336px] rounded-xl border bg-card animate-pulse" /> },
)

// Notification types the Technical Head cares about for SLA health.
const SLA_NOTIF_TYPES = ['sla_at_risk', 'sla_breached', 'case_auto_escalated']

type Tone = 'red' | 'amber' | 'violet' | 'blue'

const TONE: Record<Tone, string> = {
  red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  blue: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
}

function Panel({ title, icon: Icon, action, children }: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  action?: { label: string; href: string }
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action && (
          <Link href={action.href} className="ml-auto text-xs text-primary hover:underline inline-flex items-center gap-0.5">
            {action.label} <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

export default function TechHeadDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesData, isLoading: casesLoading, error: casesError, refetch } = useQuery({
    queryKey: ['cases', 'all', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 500 }),
  })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: clients } = useQuery({ queryKey: ['clients', session.userId], queryFn: () => dp.listClients(scope) })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
  const { data: auditLogs } = useQuery({ queryKey: ['audit-logs', 'recent'], queryFn: () => dp.listAuditLogs({ limit: 10 }) })
  const { data: metrics } = useQuery<EngineerMetrics[]>({ queryKey: ['all-engineer-metrics'], queryFn: () => dp.listAllEngineerMetrics(scope), staleTime: 30_000 })
  const { data: notifications } = useQuery<Notification[]>({ queryKey: ['notifications', session.userId], queryFn: () => dp.listNotifications(session.userId) })
  const { data: transferReqs } = useQuery<CaseTransferRequest[]>({ queryKey: ['case-transfer-requests', 'pending'], queryFn: () => dp.listAllPendingCaseTransferRequests() })
  const { data: memberReqs } = useQuery<TeamMemberRequest[]>({ queryKey: ['team-member-requests', 'pending'], queryFn: () => dp.listAllPendingTeamMemberRequests() })
  const { data: pendingKB } = useQuery<KBArticle[]>({ queryKey: ['kb', 'in_review'], queryFn: () => dp.listKBArticles({ status: 'in_review' }, scope) })
  const { data: feedback } = useQuery<Feedback[]>({ queryKey: ['feedback', session.userId], queryFn: () => dp.listFeedback(scope) })
  const { data: slaRules, isLoading: slaRulesLoading } = useQuery<SLARule[]>({ queryKey: ['sla-rules'], queryFn: () => dp.listSLARules() })

  const cases = useMemo(() => casesData?.items ?? [], [casesData])
  const usersMap = useMemo(() => Object.fromEntries((users ?? []).map((u: User) => [u.id, u])), [users])
  const clientsMap = useMemo(() => Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c])), [clients])

  const openCases = useMemo(() => cases.filter((c) => !['closed', 'resolved'].includes(c.status)), [cases])
  const escalated = useMemo(() => cases.filter((c) => c.is_escalated || c.status === 'escalated'), [cases])
  // Routing-approval queue: cases pending directly with the TH (no team owns
  // the service) plus overdue ones no team lead assigned within 30 minutes.
  const approvalQueueCount = useMemo(
    () => cases.filter((c) =>
      !c.assignee_id &&
      (c.approval_status === 'escalated' || (c.approval_status === 'pending' && c.approval_user_id === session.userId))
    ).length,
    [cases, session.userId]
  )
  const critical = useMemo(() => cases.filter((c) => c.priority === 'critical' && !['closed', 'resolved'].includes(c.status)), [cases])

  // Top KPI metrics. Capture "now" once at mount (lazy state initializer keeps
  // the render pure) so the time-window cutoffs are stable across re-renders.
  const [nowMs] = useState(() => Date.now())
  // Successful = fully closed within the last 30 days.
  const lastMonthSuccessful = useMemo(() => {
    const cutoff = nowMs - 30 * 86_400_000
    return cases.filter((c) => c.status === 'closed' && !!c.closed_at && new Date(c.closed_at).getTime() >= cutoff).length
  }, [cases, nowMs])
  // Due = SLA deadline already passed, where that deadline falls within the last 90 days.
  const last3MonthsDue = useMemo(() => {
    const cutoff = nowMs - 90 * 86_400_000
    return cases.filter((c) => {
      const due = new Date(c.sla_due_at).getTime()
      return due < nowMs && due >= cutoff
    }).length
  }, [cases, nowMs])
  // Reopened = cases spawned by reopening a previously-closed case.
  const reopenedCount = useMemo(() => cases.filter((c) => !!c.reopened_from_case_id).length, [cases])
  const criticalPendingApproval = useMemo(
    () => cases.filter((c) => c.priority === 'critical' && ['resolved', 'pending_closure'].includes(c.status) && !c.th_approved),
    [cases]
  )
  const feedbackPendingReview = useMemo(() => (feedback ?? []).filter((f) => !f.th_reviewed), [feedback])

  // SLA health
  const unreadSlaNotifs = useMemo(
    () => (notifications ?? []).filter((n) => !n.read_at && SLA_NOTIF_TYPES.includes(n.type)),
    [notifications]
  )
  const slaBreached = unreadSlaNotifs.filter((n) => n.type === 'sla_breached').length
  const slaAtRisk = unreadSlaNotifs.filter((n) => n.type === 'sla_at_risk').length
  const slaAutoEsc = unreadSlaNotifs.filter((n) => n.type === 'case_auto_escalated').length
  const avgSLA = useMemo(
    () => (metrics && metrics.length ? Math.round(metrics.reduce((s, m) => s + m.sla_compliance_pct, 0) / metrics.length) : null),
    [metrics]
  )

  // Lowest SLA-compliance engineers
  const lowPerformers = useMemo(
    () => [...(metrics ?? [])].sort((a, b) => a.sla_compliance_pct - b.sla_compliance_pct).slice(0, 3),
    [metrics]
  )

  // Open cases per team
  const workload = useMemo(() => {
    const rows = (teams ?? []).map((t: Team) => ({ team: t, count: openCases.filter((c) => c.team_id === t.id).length }))
    return rows.sort((a, b) => b.count - a.count)
  }, [teams, openCases])
  const maxTeamLoad = Math.max(1, ...workload.map((w) => w.count))

  // Action center
  const actionItems: { label: string; count: number; icon: React.ComponentType<{ className?: string }>; href: string; tone: Tone }[] = [
    { label: 'Critical resolutions awaiting approval', count: criticalPendingApproval.length, icon: ShieldCheck, href: '/technical-head?tab=approvals', tone: 'red' },
    { label: 'Escalations awaiting response', count: escalated.length, icon: AlertTriangle, href: '/technical-head?tab=escalations', tone: 'red' },
    { label: 'Case transfer requests', count: transferReqs?.length ?? 0, icon: ArrowLeftRight, href: '/teams', tone: 'amber' },
    { label: 'Team member requests', count: memberReqs?.length ?? 0, icon: UserPlus, href: '/teams', tone: 'amber' },
    { label: 'KB articles pending publish', count: pendingKB?.length ?? 0, icon: BookOpen, href: '/knowledge-base', tone: 'violet' },
    { label: 'Feedback pending review', count: feedbackPendingReview.length, icon: Star, href: '/feedback', tone: 'blue' },
  ]
  const totalPending = actionItems.reduce((s, a) => s + a.count, 0)

  const manageLinks = [
    { label: 'Support Engineers', href: '/support-engineer', icon: Users },
    { label: 'Teams', href: '/teams', icon: Users },
    { label: 'Clients', href: '/clients', icon: Building2 },
    { label: 'Solutions', href: '/solutions', icon: Lightbulb },
    { label: 'Products', href: '/products', icon: Package },
    { label: 'SLA Rules', href: '/sla-rules', icon: Gauge },
    { label: 'Knowledge Base', href: '/knowledge-base', icon: BookOpen },
    { label: 'Audit Log', href: '/audit-log', icon: Shield },
  ]

  if (session.role !== 'technical_head') return null
  if (casesError) return <ErrorState onRetry={refetch} />

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
            All cases · all teams · full visibility

            {criticalPendingApproval.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">
                <ShieldCheck className="h-2.5 w-2.5" /> {criticalPendingApproval.length} need approval
              </span>
            )}

          </p>
        </div>
        <Link href="/technical-head" className="text-sm text-primary hover:underline inline-flex items-center gap-0.5 shrink-0">
          Open TH Hub <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Open Cases" value={openCases.length} icon={Ticket} loading={casesLoading} />
        <StatCard title="Last Month Successful" value={lastMonthSuccessful} icon={CheckCircle} iconColor="text-emerald-500" loading={casesLoading} />
        <StatCard title="Last 3 Months Due" value={last3MonthsDue} icon={AlertTriangle} iconColor="text-red-500" loading={casesLoading} />
        <StatCard title="Reopened Cases" value={reopenedCount} icon={RotateCcw} iconColor="text-amber-500" loading={casesLoading} />
        <StatCard title="Total SLA" value={slaRules?.length ?? 0} icon={Gauge} iconColor="text-emerald-500" loading={slaRulesLoading} />
        <StatCard title="Pending Approvals" value={totalPending} icon={ShieldCheck} iconColor={totalPending > 0 ? 'text-amber-500' : 'text-emerald-500'} />
      </div>

      {/* Action Center */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Needs your attention</h3>
          <span className={cn('ml-auto text-xs font-semibold px-2 py-0.5 rounded-full', totalPending > 0 ? TONE.amber : TONE.blue)}>
            {totalPending > 0 ? `${totalPending} pending` : 'All caught up'}
          </span>
        </div>
        {totalPending === 0 ? (
          <EmptyState size="sm" icon={CheckCircle2} title="You're all caught up" description="No approvals or requests are waiting on you." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {actionItems.map(({ label, count, icon: Icon, href, tone }) => (
              <Link
                key={label}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                  count > 0 ? 'hover:bg-accent/40' : 'opacity-60 hover:opacity-100'
                )}
              >
                <div className={cn('rounded-md p-1.5 shrink-0', count > 0 ? TONE[tone] : 'bg-muted text-muted-foreground')}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm text-foreground flex-1 leading-tight">{label}</span>
                {count > 0 ? (
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full shrink-0', TONE[tone])}>{count}</span>
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Routing approval queue — new cases + overdue team-lead windows */}
      {approvalQueueCount > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TimerReset className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-semibold text-foreground">Case Assignment Queue</h3>
            <span className="text-[11px] text-muted-foreground">
              Unassigned cases — including team-lead windows that ran past 30 minutes
            </span>
          </div>
          <CaseApprovalQueue cases={cases} users={users ?? []} />
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Case triage preview */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="open">
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="open">Open ({openCases.length})</TabsTrigger>
                <TabsTrigger value="escalated">Escalated ({escalated.length})</TabsTrigger>
                <TabsTrigger value="critical">Critical ({critical.length})</TabsTrigger>
              </TabsList>
              <Link href="/cases" className="text-xs text-primary hover:underline inline-flex items-center gap-0.5">
                View all cases <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {([
              { value: 'open', list: openCases, empty: 'No open cases', emptyDesc: 'All cases are resolved or closed.', icon: Ticket },
              { value: 'escalated', list: escalated, empty: 'No escalated cases', emptyDesc: undefined, icon: AlertTriangle },
              { value: 'critical', list: critical, empty: 'No critical cases', emptyDesc: undefined, icon: CheckCircle },
            ] as const).map(({ value, list, empty, emptyDesc, icon }) => (
              <TabsContent key={value} value={value}>
                <ScrollArea className="h-[460px] pr-2">
                  <div className="space-y-3">
                    {list.length === 0 ? (
                      <EmptyState icon={icon} title={empty} description={emptyDesc} />
                    ) : (
                      list.slice(0, 8).map((c: Case) => (
                        <CaseCard
                          key={c.id}
                          case_={c}
                          client={clientsMap[c.client_id]}
                          assignee={c.assignee_id ? usersMap[c.assignee_id] : undefined}
                          href={`/cases/${c.id}`}
                        />
                      ))
                    )}
                    {list.length > 8 && (
                      <Link href="/cases" className="block text-center text-xs text-primary hover:underline py-2">
                        View {list.length - 8} more
                      </Link>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Side panels */}
        <div className="space-y-4">
          {/* SLA & performance */}
          <Panel title="SLA & Performance" icon={Gauge} action={{ label: 'Performance', href: '/technical-head?tab=performance' }}>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Avg SLA</p>
                <p className={cn('text-xl font-bold tabular-nums', avgSLA != null && avgSLA < 70 ? 'text-red-500' : 'text-foreground')}>
                  {avgSLA != null ? `${avgSLA}%` : '—'}
                </p>
              </div>
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Breached</p>
                <p className={cn('text-xl font-bold tabular-nums', slaBreached > 0 ? 'text-red-500' : 'text-foreground')}>{slaBreached}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
              <span>{slaAtRisk} at risk</span>
              <span className="text-muted-foreground/40">·</span>
              <span>{slaAutoEsc} auto-escalated</span>
            </div>
            {lowPerformers.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" /> Lowest SLA compliance
                </p>
                {lowPerformers.map((m) => (
                  <div key={m.engineer_id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate">{usersMap[m.engineer_id]?.name ?? m.engineer_id}</span>
                    <span className={cn(
                      'text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                      m.sla_compliance_pct >= 90 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : m.sla_compliance_pct >= 70 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    )}>
                      {m.sla_compliance_pct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Team workload */}
          <Panel title={`Team Workload (${workload.length})`} icon={Users} action={{ label: 'Workload', href: '/technical-head?tab=workload' }}>
            {workload.length === 0 ? (
              <EmptyState size="sm" icon={Users} title="No teams" />
            ) : (
              <div className="space-y-2.5">
                {workload.slice(0, 6).map(({ team, count }) => (
                  <div key={team.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-foreground truncate">{team.name}</span>
                      <span className="text-xs font-medium text-muted-foreground tabular-nums shrink-0">{count} open</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', count >= maxTeamLoad && count > 0 ? 'bg-amber-500' : 'bg-primary')}
                        style={{ width: `${Math.round((count / maxTeamLoad) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Recent activity */}
          <Panel title="Recent Activity" icon={Clock} action={{ label: 'Audit log', href: '/audit-log' }}>
            {(auditLogs ?? []).length === 0 ? (
              <EmptyState size="sm" icon={Clock} title="No recent activity" />
            ) : (
              <div className="space-y-2.5">
                {(auditLogs ?? []).slice(0, 6).map((log: AuditLog) => (
                  <div key={log.id} className="flex gap-2 text-xs">
                    <span className="text-muted-foreground shrink-0 mt-0.5">{formatDateTime(log.created_at).split(',')[0]}</span>
                    <span className="text-foreground line-clamp-1 capitalize">
                      {log.action.replace('_', ' ')} {log.entity_type} <span className="font-mono text-muted-foreground">{log.entity_id.slice(0, 6)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* Last 12 months case summary */}
      <CaseSummary12m />

      {/* Quick management links */}
      {/*<div>*/}
      {/*  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Manage</p>*/}
      {/*  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">*/}
      {/*    {manageLinks.map(({ label, href, icon: Icon }) => (*/}
      {/*      <Link*/}
      {/*        key={label}*/}
      {/*        href={href}*/}
      {/*        className="flex flex-col items-center gap-1.5 rounded-xl border bg-card p-3 text-center transition-colors hover:bg-accent/40"*/}
      {/*      >*/}
      {/*        <Icon className="h-5 w-5 text-muted-foreground" />*/}
      {/*        <span className="text-xs text-foreground">{label}</span>*/}
      {/*      </Link>*/}
      {/*    ))}*/}
      {/*  </div>*/}
      {/*</div>*/}
    </div>
  )
}