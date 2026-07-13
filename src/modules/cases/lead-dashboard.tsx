'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { UserAvatar } from '@/components/shared/user-avatar'
import { CaseApprovalQueue } from '@/modules/shared/case-approval-queue'
import { toast } from '@/hooks/use-toast'
import { cn, slaPercent, slaRemainingMs, formatDuration, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/utils'
import {
  Ticket, AlertTriangle, CheckCircle, Users, PlusCircle, Inbox, ClipboardCheck,
  ArrowRight, LayoutList, BarChart3, Bell, UserCheck, Clock, Gauge, Star,
  TimerReset, UserCog, TrendingUp, Sparkles, ExternalLink, UserPlus, Check, X, Plus,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Case, Client, Feedback, Priority, User } from '@/types'

const OPEN_EXCLUDE = ['closed', 'resolved', 'pending_closure']
const DONE_STATUSES = ['resolved', 'pending_closure', 'closed']

export default function LeadDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
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
  const { data: solutions } = useQuery({ queryKey: ['solutions'], queryFn: () => dp.listSolutions() })
  const { data: slaRules } = useQuery({ queryKey: ['sla-rules'], queryFn: () => dp.listSLARules() })

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

  // Cases routed to THIS lead awaiting assignment inside the 30-minute window.
  const approvals = cases.filter(
    (c) => c.approval_status === 'pending' && c.approval_user_id === session.userId && !c.assignee_id
  )
  // Window expired (escalated to the Technical Head) and still unassigned.
  const overdueApprovals = cases.filter(
    (c) => c.approval_status === 'escalated' && !c.assignee_id && c.approval_team_id === myUser?.team_id
  )

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

  // Demo approval card — real (but illustrative) prerequisites for creating
  // and assigning a sample case: this team's engineers, plus any client/
  // solution/SLA rule to satisfy Case's required fields.
  const demoEngineers = workload.length > 0
    ? workload.map((w) => w.eng)
    : (users ?? []).filter((u) => u.role === 'support_engineer' && u.is_active)
  const demoClientId = clients?.[0]?.id
  const demoSolutionId = (solutions ?? []).find((s) => (myTeam?.solution_ids ?? []).includes(s.id))?.id ?? solutions?.[0]?.id
  const demoSlaRuleId = (slaRules ?? []).find((r) => r.priority === 'high')?.id ?? slaRules?.[0]?.id

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

      {/* KPIs — each deep-links into the relevant workspace, laid out in a single responsive row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatLink href="/cases"><StatCard title="Total Cases" value={cases.length} icon={Ticket} loading={isLoading} /></StatLink>
        <StatLink href="/lead"><StatCard title="Open" value={open.length} icon={LayoutList} iconColor="text-blue-500" loading={isLoading} /></StatLink>
        <StatLink href="#approvals"><StatCard title="Awaiting Approval" value={approvals.length + overdueApprovals.length} icon={TimerReset} iconColor={approvals.length + overdueApprovals.length ? 'text-red-500' : 'text-muted-foreground'} loading={isLoading} /></StatLink>
        <StatLink href="#sla"><StatCard title="SLA At-Risk" value={breached.length + atRisk.length} icon={Gauge} iconColor={breached.length ? 'text-red-500' : 'text-amber-500'} loading={isLoading} /></StatLink>
        <StatLink href="/lead?tab=closure"><StatCard title="Pending Closure" value={pendingClosure.length} icon={ClipboardCheck} iconColor="text-emerald-500" loading={isLoading} /></StatLink>
      </div>

      {/* Action Required */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Approval window: new cases (0–30 min) + overdue/time-exceeded queue */}
        <div id="approvals" className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/10 p-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <TimerReset className="h-4 w-4 text-red-500 shrink-0" />
            <h2 className="text-sm font-semibold">Awaiting Your Approval</h2>
            <span className="text-[11px] text-muted-foreground">Assign within the 30-min window or it escalates to the Technical Head</span>
          </div>
          <div className="space-y-2.5">
            <DemoApprovalCard
              engineers={demoEngineers}
              clientId={demoClientId}
              solutionId={demoSolutionId}
              teamId={myUser?.team_id}
              slaRuleId={demoSlaRuleId}
            />
            <CaseApprovalQueue cases={cases} users={users ?? []} teamId={myUser?.team_id} />
          </div>
        </div>

        {/* SLA risk */}
        <div id="sla" className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/10 p-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Gauge className="h-4 w-4 text-amber-500 shrink-0" />
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

const DEMO_CASE = {
  reference_no: 'NHQ-DEMO-0001',
  title: 'Sample case — VPN connectivity issue',
  description: 'Client reports intermittent VPN drops when connecting from the branch office network, roughly every 20 minutes, requiring a manual reconnect each time.',
  priority: 'high' as Priority,
}

interface DemoApprovalCardProps {
  engineers: User[]
  clientId?: string
  solutionId?: string
  teamId?: string
  slaRuleId?: string
}

// Sample row so the approval queue always previews its layout, even with zero
// real approvals pending. The "view" button only opens a local preview modal —
// it never navigates to a case route or reads from the database. Assigning,
// however, is real: it creates and assigns an actual case, which then shows
// up on the Cases page like any other.
function DemoApprovalCard({ engineers, clientId, solutionId, teamId, slaRuleId }: DemoApprovalCardProps) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [assignedNames, setAssignedNames] = useState<string[] | null>(null)

  const addEngineer = (uid: string) => setSelectedIds((prev) => [...prev, uid])
  const removeEngineer = (uid: string) => setSelectedIds((prev) => prev.filter((id) => id !== uid))

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!clientId || !solutionId || !teamId) throw new Error('Missing client, solution or team for the demo case')
      const [primaryId, ...coIds] = selectedIds
      const created = await dp.createCase({
        title: DEMO_CASE.title,
        description: DEMO_CASE.description,
        priority: DEMO_CASE.priority,
        status: 'new',
        client_id: clientId,
        solution_id: solutionId,
        team_id: teamId,
        sla_rule_id: slaRuleId ?? '',
        sla_due_at: new Date(Date.now() + 4 * 3_600_000).toISOString(),
        escalation_level: 0,
        is_escalated: false,
      }, scope)
      const assigned = await dp.assignCase(created.id, primaryId, scope)
      if (coIds.length > 0) {
        return dp.updateCase(created.id, { co_assignee_ids: coIds }, scope)
      }
      return assigned
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['cases'] })
      const names = selectedIds.map((id) => engineers.find((e) => e.id === id)?.name ?? id)
      toast({
        title: 'Case assigned',
        description: `${updated.reference_no} → ${names.join(', ')}`,
        variant: 'success',
      })
      setAssignedNames(names)
      setAssignOpen(false)
    },
    onError: () => toast({ title: 'Failed to assign demo case', variant: 'destructive' }),
  })

  return (
    <>
      <div className="rounded-lg border border-dashed bg-card/60 p-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] text-muted-foreground">{DEMO_CASE.reference_no}</span>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', PRIORITY_COLORS[DEMO_CASE.priority])}>{PRIORITY_LABELS[DEMO_CASE.priority]}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
                <Sparkles className="h-3 w-3" /> Demo
              </span>
            </div>
            <p className="text-sm font-medium text-foreground truncate">{DEMO_CASE.title}</p>
            <p className="text-[11px] mt-0.5 inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" /> 18m left
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="View demo case details" onClick={() => setDetailsOpen(true)}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            {assignedNames ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 px-1">
                <Check className="h-3.5 w-3.5" /> Assigned to {assignedNames.join(', ')}
              </span>
            ) : (
              <Button size="sm" className="text-white bg-emerald-600 hover:bg-emerald-700" onClick={() => setAssignOpen(true)}>
                <UserPlus className="h-3.5 w-3.5" /> Assign
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* View details — a local-only preview, never a case route or DB read */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Demo Case Preview
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground">{DEMO_CASE.reference_no}</span>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', PRIORITY_COLORS[DEMO_CASE.priority])}>{PRIORITY_LABELS[DEMO_CASE.priority]}</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{DEMO_CASE.title}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{DEMO_CASE.description}</p>
            <p className="text-xs text-muted-foreground border-t pt-2.5">
              This is a sample preview only — it isn&apos;t linked to a real case record or route. Assigning it below creates a real case that will appear on the Cases page.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign — select one or more engineers, then creates and assigns a real case on confirm */}
      <Dialog open={assignOpen} onOpenChange={(o) => { setAssignOpen(o); if (!o) setSelectedIds([]) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" /> Assign Case
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span className="font-mono text-xs text-muted-foreground">{DEMO_CASE.reference_no}</span>
              <p className="font-medium mt-0.5 line-clamp-2">{DEMO_CASE.title}</p>
            </div>

            <div className="space-y-1.5">
              <Label>
                Engineers <span className="text-destructive">*</span>
                {selectedIds.length > 0 && <span className="text-muted-foreground font-normal"> ({selectedIds.length})</span>}
              </Label>

              {selectedIds.length > 0 && (
                <div className="space-y-1.5">
                  {selectedIds.map((uid) => {
                    const eng = engineers.find((e) => e.id === uid)
                    if (!eng) return null
                    return (
                      <div key={uid} className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5">
                        <UserAvatar name={eng.name} size="sm" />
                        <span className="flex-1 min-w-0 text-sm font-medium truncate">{eng.name}</span>
                        <button
                          type="button"
                          onClick={() => removeEngineer(uid)}
                          className="h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          aria-label={`Remove ${eng.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {engineers.filter((e) => e.is_active && !selectedIds.includes(e.id)).length > 0 && (
                <Select value="" onValueChange={addEngineer}>
                  <SelectTrigger>
                    <SelectValue placeholder={
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Plus className="h-3.5 w-3.5" /> Add engineer…
                      </span>
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {engineers.filter((e) => e.is_active && !selectedIds.includes(e.id)).map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button
              onClick={() => assignMutation.mutate()}
              disabled={selectedIds.length === 0 || !clientId || !solutionId || !teamId || assignMutation.isPending}
            >
              {assignMutation.isPending ? 'Assigning…' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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