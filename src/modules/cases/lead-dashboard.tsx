'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { StatCard } from '@/components/shared/stat-card'
import { CaseCard } from '@/components/shared/case-card'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { cn, slaPercent, slaRemainingMs, formatDuration, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/utils'
import {
  Ticket, AlertTriangle, CheckCircle, Users, PlusCircle, Inbox, ClipboardCheck,
  ArrowRight, LayoutList, BarChart3, Bell, UserCheck, Clock, Gauge, Star,
  TimerReset, ShieldCheck, UserCog, ExternalLink, TrendingUp,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Case, Client, Feedback, User } from '@/types'

const OPEN_EXCLUDE = ['closed', 'resolved', 'pending_closure']
const DONE_STATUSES = ['resolved', 'pending_closure', 'closed']

// Re-render on an interval so approval-window countdowns tick down live.
function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export default function LeadDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()
  const now = useNow()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesData, isLoading, error, refetch } = useQuery({
    queryKey: ['cases', 'lead', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 200 }),
    refetchInterval: 60_000,
  })
  const { data: clients } = useQuery({ queryKey: ['clients', session.userId], queryFn: () => dp.listClients(scope) })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
  const { data: feedback } = useQuery({ queryKey: ['feedback', 'lead'], queryFn: () => dp.listFeedback(scope) })
  const { data: notifications } = useQuery({ queryKey: ['notifications', session.userId], queryFn: () => dp.listNotifications(session.userId) })

  const acceptApproval = useMutation({
    mutationFn: (caseId: string) => dp.acceptCaseApproval(caseId, scope),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['cases'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast({ title: 'Case accepted', description: updated.reference_no, variant: 'success' })
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  const cases = casesData?.items ?? []
  const clientsMap = Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c]))
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))

  const myUser = (users ?? []).find((u) => u.id === session.userId)
  const myTeam = (teams ?? []).find((t) => t.id === myUser?.team_id)

  // ── Case buckets ───────────────────────────────────────────────────────────
  const open = cases.filter((c) => !OPEN_EXCLUDE.includes(c.status))
  const unassigned = cases.filter((c) => !c.assignee_id && ['new', 'triaged'].includes(c.status))
  const inProgress = cases.filter((c) => c.status === 'in_progress')
  const escalated = cases.filter((c) => c.status === 'escalated' || c.is_escalated)
  const pendingClosure = cases.filter((c) => c.status === 'pending_closure')
  const engineerChanges = cases.filter((c) => c.has_pending_engineer_change)

  // Cases routed to THIS lead awaiting acceptance inside the 30-minute window.
  const approvals = cases
    .filter((c) => c.approval_status === 'pending' && c.approval_user_id === session.userId)
    .sort((a, b) => new Date(a.approval_deadline ?? 0).getTime() - new Date(b.approval_deadline ?? 0).getTime())

  // SLA risk among open cases.
  const breached = open.filter((c) => slaRemainingMs(c.sla_due_at) <= 0)
  const atRisk = open.filter((c) => slaRemainingMs(c.sla_due_at) > 0 && slaPercent(c.created_at, c.sla_due_at) >= 80)
  const slaRisk = [...breached, ...atRisk].sort((a, b) => slaRemainingMs(a.sla_due_at) - slaRemainingMs(b.sla_due_at))

  // ── Team performance ───────────────────────────────────────────────────────
  const doneCases = cases.filter((c) => DONE_STATUSES.includes(c.status))
  const resolvedWithTime = cases.filter((c) => c.resolved_at)
  const slaCompliance = resolvedWithTime.length
    ? Math.round(
        (resolvedWithTime.filter((c) => new Date(c.resolved_at!).getTime() <= new Date(c.sla_due_at).getTime()).length /
          resolvedWithTime.length) * 100
      )
    : null
  const avgResolutionMs = resolvedWithTime.length
    ? resolvedWithTime.reduce((s, c) => s + (new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime()), 0) / resolvedWithTime.length
    : null
  const ratedFeedback = (feedback ?? []).filter((f: Feedback) => f.rating != null)
  const avgRating = ratedFeedback.length ? ratedFeedback.reduce((s, f) => s + (f.rating ?? 0), 0) / ratedFeedback.length : null

  // Team workload snapshot — engineers in this lead's team, sorted by open load.
  const workload = (users ?? [])
    .filter((u) => u.role === 'support_engineer' && u.team_id === myUser?.team_id && u.is_active)
    .map((eng) => {
      const engOpen = open.filter((c) => c.assignee_id === eng.id)
      const critical = engOpen.filter((c) => c.priority === 'critical').length
      const engBreached = engOpen.filter((c) => slaRemainingMs(c.sla_due_at) <= 0).length
      return { eng, open: engOpen.length, critical, breached: engBreached }
    })
    .sort((a, b) => b.open - a.open)
  const maxLoad = Math.max(...workload.map((w) => w.open), 1)

  const unreadCount = (notifications ?? []).filter(
    (n) => !n.read_at && ['new_case', 'case_pending_approval', 'case_escalated', 'client_replied'].includes(n.type)
  ).length

  if (error) return <ErrorState onRetry={refetch} />

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Team Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {myTeam ? myTeam.name : 'Your team'} · {workload.length} engineer{workload.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push('/lead')}>
            <LayoutList className="h-4 w-4" /> Lead Hub
          </Button>
          <Button onClick={() => router.push('/cases/new')}>
            <PlusCircle className="h-4 w-4" /> New Case
          </Button>
        </div>
      </div>

      {/* KPIs — each deep-links into the relevant workspace */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatLink href="/cases"><StatCard title="Total Cases" value={cases.length} icon={Ticket} loading={isLoading} /></StatLink>
        <StatLink href="/cases"><StatCard title="Total Resolved" value={doneCases.length} icon={CheckCircle} iconColor="text-emerald-500" loading={isLoading} /></StatLink>
        <StatLink href="/lead?tab=queue"><StatCard title="Queue" value={unassigned.length} icon={Inbox} iconColor="text-violet-500" loading={isLoading} /></StatLink>
        <StatLink href="/lead"><StatCard title="Open" value={open.length} icon={LayoutList} iconColor="text-blue-500" loading={isLoading} /></StatLink>
        <StatLink href="#approvals"><StatCard title="Awaiting Approval" value={approvals.length} icon={TimerReset} iconColor={approvals.length ? 'text-red-500' : 'text-muted-foreground'} loading={isLoading} /></StatLink>
        <StatLink href="#sla"><StatCard title="SLA At-Risk" value={breached.length + atRisk.length} icon={Gauge} iconColor={breached.length ? 'text-red-500' : 'text-amber-500'} loading={isLoading} /></StatLink>
        <StatLink href="/lead?tab=closure"><StatCard title="Pending Closure" value={pendingClosure.length} icon={ClipboardCheck} iconColor="text-emerald-500" loading={isLoading} /></StatLink>
      </div>

      {/* Action Required — only shown when there's something to act on */}
      {(approvals.length > 0 || slaRisk.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Approval window */}
          <div id="approvals" className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/10 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TimerReset className="h-4 w-4 text-red-500" />
              <h2 className="text-sm font-semibold">Awaiting Your Approval</h2>
              <span className="text-[11px] text-muted-foreground">Accept within the 30-min window or it escalates to the Technical Head</span>
            </div>
            {approvals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nothing awaiting approval right now.</p>
            ) : (
              <div className="space-y-2.5">
                {approvals.map((c) => {
                  const remaining = c.approval_deadline ? new Date(c.approval_deadline).getTime() - now : null
                  const urgent = remaining != null && remaining < 5 * 60_000
                  return (
                    <div key={c.id} className="rounded-lg border bg-card p-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground">{c.reference_no}</span>
                          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', PRIORITY_COLORS[c.priority])}>{PRIORITY_LABELS[c.priority]}</span>
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                        <p className={cn('text-[11px] mt-0.5 inline-flex items-center gap-1', urgent ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted-foreground')}>
                          <Clock className="h-3 w-3" />
                          {remaining == null ? 'No deadline' : remaining <= 0 ? 'Deadline passed' : `${formatDuration(remaining)} left`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push(`/cases/${c.id}`)}><ExternalLink className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" disabled={acceptApproval.isPending} onClick={() => acceptApproval.mutate(c.id)}>
                          <ShieldCheck className="h-3.5 w-3.5" /> Accept
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* SLA risk */}
          <div id="sla" className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/10 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold">SLA Risk</h2>
              <span className="text-[11px] text-muted-foreground">{breached.length} breached · {atRisk.length} at-risk</span>
            </div>
            {slaRisk.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">All open cases are comfortably within SLA.</p>
            ) : (
              <ScrollArea className="max-h-[220px] pr-2">
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
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Needs Attention — action-focused queue */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold">Needs Attention</h2>
            <span className="text-xs text-muted-foreground">Items waiting on the team or you</span>
          </div>
          <Tabs defaultValue="unassigned">
            <TabsList>
              <TabsTrigger value="unassigned">Unassigned ({unassigned.length})</TabsTrigger>
              <TabsTrigger value="assigned">In Progress ({inProgress.length})</TabsTrigger>
              <TabsTrigger value="escalated">Escalated ({escalated.length})</TabsTrigger>
              <TabsTrigger value="changes">Engineer Change ({engineerChanges.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="unassigned" className="mt-4">
              <CaseList
                cases={unassigned} clientsMap={clientsMap} usersMap={usersMap} unassigned
                empty={<EmptyState icon={Inbox} title="Nothing unassigned" description="New and triaged cases waiting for an engineer will appear here." />}
              />
            </TabsContent>
            <TabsContent value="assigned" className="mt-4">
              <CaseList cases={inProgress} clientsMap={clientsMap} usersMap={usersMap}
                empty={<EmptyState icon={UserCheck} title="No cases in progress" description="Cases engineers are actively working will appear here." />} />
            </TabsContent>
            <TabsContent value="escalated" className="mt-4">
              <CaseList cases={escalated} clientsMap={clientsMap} usersMap={usersMap}
                empty={<EmptyState icon={AlertTriangle} title="No escalated cases" description="No cases need escalation handling." />} />
            </TabsContent>
            <TabsContent value="changes" className="mt-4">
              <CaseList cases={engineerChanges} clientsMap={clientsMap} usersMap={usersMap}
                empty={<EmptyState icon={UserCog} title="No engineer change requests" description="Client requests to change the assigned engineer will appear here for your decision." />} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          {/* Team performance */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Team Performance</h3>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <PerfTile icon={<Gauge className="h-3.5 w-3.5 text-emerald-500" />} label="SLA Compliance" value={slaCompliance != null ? `${slaCompliance}%` : '—'} />
              <PerfTile icon={<Clock className="h-3.5 w-3.5 text-blue-400" />} label="Avg Resolution" value={avgResolutionMs != null ? formatDuration(avgResolutionMs) : '—'} />
              <PerfTile icon={<Star className="h-3.5 w-3.5 text-amber-400" />} label="Avg Rating" value={avgRating != null ? `${avgRating.toFixed(1)}/5` : '—'} />
              <PerfTile icon={<CheckCircle className="h-3.5 w-3.5 text-emerald-500" />} label="Resolved" value={String(doneCases.length)} />
            </div>
          </div>

          {/* Team workload snapshot */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Team Workload</h3>
              </div>
              <Link href="/lead?tab=workload" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                Details <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {workload.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No engineers in this team.</p>
            ) : (
              <div className="space-y-3">
                {workload.slice(0, 6).map(({ eng, open: load, critical, breached: engBreached }) => (
                  <Link key={eng.id} href={`/engineer/${eng.id}`} className="block group">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground truncate group-hover:text-primary">{eng.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {critical > 0 && (
                          <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" />{critical}</span>
                        )}
                        {engBreached > 0 && <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">{engBreached} breach</span>}
                        <span className={cn('text-sm font-bold tabular-nums', load > 5 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>{load}</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', load === 0 ? 'bg-emerald-400' : load > 5 ? 'bg-red-500' : load > 2 ? 'bg-amber-500' : 'bg-primary')}
                        style={{ width: `${Math.round((load / maxLoad) * 100)}%` }} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
            <div className="space-y-1">
              <QuickAction href="/lead?tab=closure" icon={ClipboardCheck} label="Closure Review" badge={pendingClosure.length} />
              <QuickAction href="/lead?tab=queue" icon={Inbox} label="Assign Queue" badge={unassigned.length} />
              <QuickAction href="/lead?tab=activity" icon={Bell} label="Team Activity" badge={unreadCount} />
              <QuickAction href="/feedback" icon={Star} label="Review Feedback" />
              <QuickAction href="/reporting" icon={BarChart3} label="Reporting" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CaseList({ cases, clientsMap, usersMap, unassigned, empty }: {
  cases: Case[]
  clientsMap: Record<string, Client>
  usersMap: Record<string, User>
  unassigned?: boolean
  empty: React.ReactNode
}) {
  return (
    <ScrollArea className="h-[440px] pr-2">
      <div className="space-y-3">
        {cases.length === 0 ? empty : cases.map((c) => (
          <CaseCard
            key={c.id}
            case_={c}
            client={clientsMap[c.client_id]}
            assignee={c.assignee_id ? usersMap[c.assignee_id] : undefined}
            href={`/cases/${c.id}`}
            unassigned={unassigned}
          />
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
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {children}
    </Link>
  )
}

function QuickAction({ href, icon: Icon, label, badge }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; badge?: number }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold h-5 min-w-5 px-1.5">{badge}</span>
      )}
      <ArrowRight className="h-3.5 w-3.5 opacity-50" />
    </Link>
  )
}