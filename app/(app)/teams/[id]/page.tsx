'use client'

import { use, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts'
import type { ReactNode } from 'react'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { UserAvatar } from '@/components/shared/user-avatar'
import { StatusBadge } from '@/components/shared/status-badge'
import { PriorityChip } from '@/components/shared/priority-chip'
import { SLACountdown } from '@/components/shared/sla-countdown'
import { ErrorState } from '@/components/shared/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { ROLE_LABELS } from '@/lib/rbac'
import { formatDateTime, formatDuration } from '@/lib/utils'
import {
  ArrowLeft, Headset, Users, CheckCircle2, Clock,
  Star, AlertTriangle, Ticket, TrendingUp, TrendingDown, Minus,
  UserPlus, UserMinus, ArrowRightLeft, Plus, X,
  ClockIcon, CheckCircle, XCircle, ChevronRight,
} from 'lucide-react'
import type { Case, User, EngineerMetrics, Team, TeamMemberRequest, CaseTransferRequest, Solution } from '@/types'

const MEMBER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }
  const isTH = session.role === 'technical_head'

  const [showManageMembers, setShowManageMembers] = useState(false)
  const [showTransferCase, setShowTransferCase] = useState(false)
  const [showEditServices, setShowEditServices] = useState(false)
  const [editServiceIds, setEditServiceIds] = useState<string[]>([])

  const { data: team, isLoading: loadingTeam, error } = useQuery({
    queryKey: ['team', id],
    queryFn: () => dp.getTeam(id),
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => dp.listUsers(),
  })

  const { data: allTeams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => dp.listTeams(),
  })

  const { data: solutions } = useQuery({
    queryKey: ['solutions'],
    queryFn: () => dp.listSolutions(),
  })

  const { data: casesPage, isLoading: loadingCases } = useQuery({
    queryKey: ['cases', 'team', id],
    queryFn: () => dp.listCases(scope, { team_id: id, pageSize: 500 }),
    enabled: !!team,
  })

  const { data: allMetrics } = useQuery({
    queryKey: ['engineer-metrics-all'],
    queryFn: () => dp.listAllEngineerMetrics(scope),
    enabled: !!team,
  })

  const { data: memberRequests } = useQuery({
    queryKey: ['team-member-requests', id],
    queryFn: () => dp.listTeamMemberRequests(id),
    enabled: !!team,
  })

  const { data: caseTransferRequests } = useQuery({
    queryKey: ['case-transfer-requests', id],
    queryFn: () => dp.listCaseTransferRequests(id),
    enabled: !!team,
  })

  // Mutation: assign engineer to this team (technical_head only)
  const assignMutation = useMutation({
    mutationFn: (userId: string) => dp.updateUser(userId, { team_id: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Engineer added to team', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to add engineer', variant: 'destructive' }),
  })

  // Mutation: remove engineer from this team (technical_head only)
  const removeMutation = useMutation({
    mutationFn: (userId: string) => dp.updateUser(userId, { team_id: undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Engineer removed from team', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to remove engineer', variant: 'destructive' }),
  })

  // Mutation: submit a request (team_lead)
  const requestMutation = useMutation({
    mutationFn: (input: Omit<TeamMemberRequest, 'id' | 'created_at'>) =>
      dp.createTeamMemberRequest(input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['team-member-requests', id] })
      qc.invalidateQueries({ queryKey: ['team-member-requests', 'all-pending'] })
      toast({
        title: vars.type === 'add' ? 'Add request sent to Technical Head' : 'Remove request sent to Technical Head',
        variant: 'success',
      })
    },
    onError: () => toast({ title: 'Failed to send request', variant: 'destructive' }),
  })

  // Mutation: submit a case transfer request (team_lead)
  const caseTransferRequestMutation = useMutation({
    mutationFn: (input: Omit<CaseTransferRequest, 'id' | 'created_at'>) =>
      dp.createCaseTransferRequest(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['case-transfer-requests', id] })
      qc.invalidateQueries({ queryKey: ['case-transfer-requests', 'all-pending'] })
      toast({ title: 'Transfer request sent to Technical Head', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to send transfer request', variant: 'destructive' }),
  })

  // Mutation: resolve a case transfer request (technical_head — approve/reject)
  const resolveCaseTransferMutation = useMutation({
    mutationFn: ({ reqId, status }: { reqId: string; status: 'approved' | 'rejected' }) =>
      dp.updateCaseTransferRequest(reqId, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['case-transfer-requests', id] })
      qc.invalidateQueries({ queryKey: ['case-transfer-requests', 'all-pending'] })
      toast({ title: 'Transfer request updated', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to update transfer request', variant: 'destructive' }),
  })

  // Mutation: approve a request (technical_head)
  const approveMutation = useMutation({
    mutationFn: (reqId: string) => dp.approveTeamMemberRequest(reqId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-member-requests', id] })
      qc.invalidateQueries({ queryKey: ['team-member-requests', 'all-pending'] })
      qc.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Request approved', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to approve request', variant: 'destructive' }),
  })

  // Mutation: reject a request (technical_head)
  const rejectMutation = useMutation({
    mutationFn: (reqId: string) => dp.rejectTeamMemberRequest(reqId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-member-requests', id] })
      qc.invalidateQueries({ queryKey: ['team-member-requests', 'all-pending'] })
      toast({ title: 'Request rejected', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to reject request', variant: 'destructive' }),
  })

  // Mutation: update team support services (technical_head only)
  const updateServicesMutation = useMutation({
    mutationFn: (solution_ids: string[]) => dp.updateTeam(id, { solution_ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team', id] })
      qc.invalidateQueries({ queryKey: ['teams'] })
      toast({ title: 'Support services updated', variant: 'success' })
      setShowEditServices(false)
    },
    onError: () => toast({ title: 'Failed to update services', variant: 'destructive' }),
  })

  // Mutation: transfer case to another team
  const transferMutation = useMutation({
    mutationFn: ({ caseId, targetTeamId }: { caseId: string; targetTeamId: string }) =>
      dp.updateCase(caseId, { team_id: targetTeamId, assignee_id: undefined }, scope),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases', 'team', id] })
      qc.invalidateQueries({ queryKey: ['cases'] })
      toast({ title: 'Case transferred to new team', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to transfer case', variant: 'destructive' }),
  })

  if (loadingTeam) return <TeamDetailSkeleton onBack={() => router.back()} showBack={isTH} />
  if (error || !team) return (
    <div className="p-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <ErrorState message="Team not found." />
    </div>
  )

  const allUsers: User[] = users ?? []
  const members = allUsers.filter((u) => u.team_id === id)
  const lead = allUsers.find((u) => u.id === team.lead_user_id)

  const availableEngineers = allUsers.filter(
    (u) => u.role === 'support_engineer' && u.team_id !== id && u.is_active
  )

  const cases: Case[] = casesPage?.items ?? []
  const resolvedCases = cases.filter((c) => ['resolved', 'pending_closure', 'closed'].includes(c.status))
  const openCases = cases.filter((c) => !['resolved', 'pending_closure', 'closed'].includes(c.status))
  const escalatedCases = cases.filter((c) => c.is_escalated || c.status === 'escalated')

  const transferableCases = cases.filter((c) => !['closed'].includes(c.status))
  const otherTeams = (allTeams ?? []).filter((t: Team) => t.id !== id)

  const resolvedWithTime = resolvedCases.filter((c) => c.resolved_at)
  const avgResolutionMs = resolvedWithTime.length > 0
    ? resolvedWithTime.reduce((sum, c) =>
        sum + (new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime()), 0)
      / resolvedWithTime.length
    : null
  const avgResolutionHours = avgResolutionMs != null ? avgResolutionMs / 3_600_000 : null

  const slaCases = resolvedWithTime.filter((c) => c.sla_due_at)
  const slaCompliantCount = slaCases.filter((c) =>
    new Date(c.resolved_at!).getTime() <= new Date(c.sla_due_at!).getTime()
  ).length
  const slaCompliancePct = slaCases.length > 0 ? (slaCompliantCount / slaCases.length) * 100 : null

  // Success rate: share of all team-handled cases that ended up resolved.
  const successRatePct = cases.length > 0 ? (resolvedCases.length / cases.length) * 100 : null

  // Contribution: share of all team cases each member is the assignee on.
  const memberContribution = members.map((m, i) => ({
    name: m.name,
    value: cases.filter((c) => c.assignee_id === m.id).length,
    color: MEMBER_COLORS[i % MEMBER_COLORS.length],
  }))
  const unassignedCount = cases.filter(
    (c) => !c.assignee_id || !members.some((m) => m.id === c.assignee_id)
  ).length
  const contributionData = [
    ...memberContribution,
    ...(unassignedCount > 0 ? [{ name: 'Unassigned', value: unassignedCount, color: '#94a3b8' }] : []),
  ].filter((d) => d.value > 0)

  // Monthly activity: cases this team actually resolved, by the month they were resolved (last 6 months).
  // Anchored to the most recent activity in the data (rather than the real wall clock) so the
  // window still lines up with seeded/demo data whose dates don't track the current date.
  const monthlyActivityData = (() => {
    const referenceDate = cases.length > 0
      ? new Date(Math.max(...cases.map((c) => new Date(c.resolved_at ?? c.created_at).getTime())))
      : new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (5 - i), 1)
      const monthIdx = d.getMonth()
      const year = d.getFullYear()
      return {
        name: d.toLocaleString('default', { month: 'short' }),
        Resolved: resolvedCases.filter((c) => {
          if (!c.resolved_at) return false
          const rd = new Date(c.resolved_at)
          return rd.getMonth() === monthIdx && rd.getFullYear() === year
        }).length,
      }
    })
  })()
  const hasMonthlyActivity = monthlyActivityData.some((d) => d.Resolved > 0)
  // Month-over-month change: latest tracked month vs the one right before it.
  const currentMonth = monthlyActivityData[monthlyActivityData.length - 1]
  const previousMonth = monthlyActivityData[monthlyActivityData.length - 2]
  const momDelta = hasMonthlyActivity && currentMonth && previousMonth
    ? currentMonth.Resolved - previousMonth.Resolved
    : null

  const metricsMap = Object.fromEntries(
    (allMetrics ?? []).map((m: EngineerMetrics) => [m.engineer_id, m])
  )

  const memberSatisfactions = members
    .map((m) => metricsMap[m.id]?.satisfaction_score)
    .filter((s): s is number => s != null)
  const avgSatisfaction = memberSatisfactions.length > 0
    ? memberSatisfactions.reduce((a, b) => a + b, 0) / memberSatisfactions.length
    : null

  const canManage = ['team_lead', 'technical_head'].includes(session.role)
  const solutionsMap = Object.fromEntries((solutions ?? []).map((s: Solution) => [s.id, s]))

  const pendingMemberRequests = (memberRequests ?? []).filter((r) => r.status === 'pending')
  const pendingTransferRequests = (caseTransferRequests ?? []).filter((r) => r.status === 'pending')
  const totalPending = pendingMemberRequests.length + pendingTransferRequests.length
  const pendingRequests = pendingMemberRequests  // kept for member-specific checks
  const usersMap = Object.fromEntries(allUsers.map((u) => [u.id, u]))
  const casesMap = Object.fromEntries(cases.map((c) => [c.id, c]))

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {isTH && (
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back to Teams
        </Button>
      )}

      {/* Team header */}
      <div className="rounded-xl border bg-card p-5 flex items-start gap-4 flex-wrap">
        <div className="rounded-xl bg-primary/10 p-3 shrink-0">
          <Headset className="h-7 w-7 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{team.name}</h1>
          </div>
          {lead && (
            <div
              className="flex items-center gap-2 mt-1 cursor-pointer w-fit hover:opacity-75 transition-opacity"
              onClick={() => router.push(`/users/${lead.id}`)}
            >
              <UserAvatar name={lead.name} size="sm" />
              <span className="text-sm text-muted-foreground">
                Lead: <span className="font-medium text-foreground">{lead.name}</span>
                <span className="ml-1 text-xs">({ROLE_LABELS[lead.role]})</span>
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground shrink-0">Services:</span>
            {(team.solution_ids ?? []).length === 0 ? (
              <span className="text-xs text-muted-foreground italic">None set</span>
            ) : (
              (team.solution_ids ?? []).map((sid) => {
                const sol = solutionsMap[sid]
                return sol ? (
                  <Badge key={sid} variant="outline" className="text-[10px] h-5 px-2">{sol.name}</Badge>
                ) : null
              })
            )}
            {isTH && (
              <button
                className="text-[11px] text-primary hover:underline ml-1 cursor-pointer"
                onClick={() => { setEditServiceIds(team.solution_ids ?? []); setShowEditServices(true) }}
              >
                Edit
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Created {formatDateTime(team.created_at)}</p>
        </div>
        {/* Action buttons */}
        {canManage && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Button size="sm" variant="outline" onClick={() => setShowManageMembers(true)}>
                <UserPlus className="h-3.5 w-3.5" /> Manage Engineers
              </Button>
              {isTH && totalPending > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                </span>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowTransferCase(true)}>
              <ArrowRightLeft className="h-3.5 w-3.5" /> {isTH ? 'Transfer Case' : 'Transfer Request'}
            </Button>
          </div>
        )}
      </div>

      {/* Pending Requests — visible only to technical_head */}
      {isTH && totalPending > 0 && (
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold">Pending Requests</h2>
            <Badge className="text-[10px] h-4 px-1.5 bg-amber-500 hover:bg-amber-500 text-white">
              {totalPending}
            </Badge>
          </div>

          {/* Member requests */}
          {pendingMemberRequests.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Engineer Changes</p>
              {pendingMemberRequests.map((req) => {
                const requester = usersMap[req.requested_by]
                const targetUsers = req.user_ids.map((uid) => usersMap[uid]).filter(Boolean)
                return (
                  <div key={req.id} className="flex items-start gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-4 px-1.5 ${req.type === 'add' ? 'border-emerald-500 text-emerald-600' : 'border-red-400 text-red-500'}`}
                        >
                          {req.type === 'add' ? '+ Add Request' : '− Remove Request'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          by <span className="font-medium text-foreground">{requester?.name ?? 'Unknown'}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">{formatDateTime(req.created_at)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {targetUsers.map((u) => (
                          <div key={u.id} className="flex items-center gap-1 text-xs bg-background border rounded px-1.5 py-0.5">
                            <UserAvatar name={u.name} size="sm" />
                            <span>{u.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-emerald-600 border-emerald-500 hover:bg-emerald-50"
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        onClick={() => approveMutation.mutate(req.id)}
                      >
                        <CheckCircle className="h-3 w-3" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-red-500 border-red-400 hover:bg-red-50"
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        onClick={() => rejectMutation.mutate(req.id)}
                      >
                        <XCircle className="h-3 w-3" /> Reject
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Case transfer requests */}
          {pendingTransferRequests.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Case Transfer Requests</p>
              {pendingTransferRequests.map((req) => {
                const requester = usersMap[req.requested_by]
                const c = casesMap[req.case_id]
                return (
                  <div key={req.id} className="flex items-start gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-blue-400 text-blue-600">
                          <ArrowRightLeft className="h-2.5 w-2.5 mr-0.5" /> Transfer Request
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          by <span className="font-medium text-foreground">{requester?.name ?? 'Unknown'}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">{formatDateTime(req.created_at)}</span>
                      </div>
                      {c && (
                        <div className="flex items-center gap-2 text-xs text-foreground mt-1">
                          <span className="font-mono text-muted-foreground">{c.reference_no}</span>
                          <span className="truncate">{c.title}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-emerald-600 border-emerald-500 hover:bg-emerald-50"
                        disabled={resolveCaseTransferMutation.isPending}
                        onClick={() => resolveCaseTransferMutation.mutate({ reqId: req.id, status: 'approved' })}
                      >
                        <CheckCircle className="h-3 w-3" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-red-500 border-red-400 hover:bg-red-50"
                        disabled={resolveCaseTransferMutation.isPending}
                        onClick={() => resolveCaseTransferMutation.mutate({ reqId: req.id, status: 'rejected' })}
                      >
                        <XCircle className="h-3 w-3" /> Reject
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard icon={<Ticket className="h-5 w-5 text-blue-500" />} label="Total Cases" value={String(cases.length)} />
        <KpiCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} label="Resolved" value={String(resolvedCases.length)} />
        <KpiCard icon={<AlertTriangle className="h-5 w-5 text-amber-500" />} label="Open" value={String(openCases.length)} />
        <KpiCard icon={<AlertTriangle className="h-5 w-5 text-red-500" />} label="Escalated" value={String(escalatedCases.length)} />
      </div>

      {/* Performance metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 flex items-start gap-3">
          <Clock className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Avg Resolution Time</p>
            <p className="text-xl font-bold text-foreground">
              {avgResolutionHours != null ? formatDuration(avgResolutionHours * 3_600_000) : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              across {resolvedWithTime.length} resolved case{resolvedWithTime.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <p className="text-xs text-muted-foreground">SLA Compliance</p>
            {slaCompliancePct != null && (
              <span className={`ml-auto text-sm font-bold ${
                slaCompliancePct >= 90 ? 'text-emerald-600'
                : slaCompliancePct >= 70 ? 'text-amber-600'
                : 'text-red-600'}`}>
                {slaCompliancePct.toFixed(0)}%
              </span>
            )}
          </div>
          {slaCompliancePct != null ? (
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  slaCompliancePct >= 90 ? 'bg-emerald-500'
                  : slaCompliancePct >= 70 ? 'bg-amber-500'
                  : 'bg-red-500'}`}
                style={{ width: `${Math.min(slaCompliancePct, 100)}%` }}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data yet</p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {slaCompliantCount} of {slaCases.length} cases within SLA
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 flex items-start gap-3">
          <Star className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Team Satisfaction</p>
            <p className="text-xl font-bold text-foreground">
              {avgSatisfaction != null ? `${avgSatisfaction.toFixed(1)} / 5` : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              avg across {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Team success rate */}
      {successRatePct != null && (
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-semibold">Team Success Rate</span>
            </div>
            <span className={`text-sm font-bold ${
              successRatePct >= 90 ? 'text-emerald-600'
              : successRatePct >= 70 ? 'text-amber-600'
              : 'text-red-600'}`}>
              {successRatePct.toFixed(0)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                successRatePct >= 90 ? 'bg-emerald-500'
                : successRatePct >= 70 ? 'bg-amber-500'
                : 'bg-red-500'}`}
              style={{ width: `${Math.min(successRatePct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {resolvedCases.length} resolved out of {cases.length} case{cases.length !== 1 ? 's' : ''} handled by this team
          </p>
        </div>
      )}

      {/* Team member contribution + monthly resolved activity */}
      {(contributionData.length > 0 || hasMonthlyActivity) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {contributionData.length > 0 && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold">Team Contribution</p>
                <p className="text-xs text-muted-foreground">Share of all cases handled by each member</p>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={contributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {contributionData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => {
                      const n = Number(value)
                      return [`${n} case${n !== 1 ? 's' : ''} (${((n / cases.length) * 100).toFixed(0)}%)`, name]
                    }}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {hasMonthlyActivity && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Monthly Activity</p>
                  <p className="text-xs text-muted-foreground">Cases resolved by this team (last 6 months)</p>
                </div>
                {momDelta != null && (
                  <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold shrink-0 ${
                    momDelta > 0 ? 'bg-emerald-500/10 text-emerald-600'
                    : momDelta < 0 ? 'bg-red-500/10 text-red-600'
                    : 'bg-muted text-muted-foreground'}`}>
                    {momDelta > 0 ? <TrendingUp className="h-3 w-3" />
                      : momDelta < 0 ? <TrendingDown className="h-3 w-3" />
                      : <Minus className="h-3 w-3" />}
                    {momDelta > 0 ? `+${momDelta}` : momDelta} vs last month
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyActivityData} barSize={26} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                    formatter={(value) => {
                      const n = Number(value)
                      return [`${n} case${n !== 1 ? 's' : ''}`, 'Resolved']
                    }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="Resolved" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32}>
                    <LabelList
                      dataKey="Resolved"
                      position="top"
                      style={{ fontSize: 11, fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Members panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Members <span className="text-sm font-normal text-muted-foreground">({members.length})</span>
            </h2>
            {canManage && (
              <div className="relative">
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary" onClick={() => setShowManageMembers(true)}>
                  <Plus className="h-3 w-3" /> Manage
                </Button>
                {isTH && totalPending > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                  </span>
                )}
              </div>
            )}
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No members assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => {
                const metrics = metricsMap[m.id]
                const isLeadCard = m.id === team.lead_user_id
                const memberHref = isLeadCard && session.role === 'team_lead'
                  ? '/dashboard'
                  : m.role === 'support_engineer' ? `/support-engineer/${m.id}`
                  : m.role === 'team_lead' ? `/team-lead/${m.id}`
                  : `/users/${m.id}`
                return (
                  <div
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    aria-label={isLeadCard && session.role === 'team_lead' ? 'Go to your dashboard' : `View ${m.name}'s profile`}
                    className="group relative rounded-xl border bg-card p-3 flex items-start gap-3 cursor-pointer transition-all hover:border-primary/40 hover:shadow-sm hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    onClick={() => router.push(memberHref)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        router.push(memberHref)
                      }
                    }}
                  >
                    <UserAvatar name={m.name} />
                    <div className="flex-1 min-w-0 pr-5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{m.name}</p>
                        {m.id === team.lead_user_id && (
                          <Badge variant="default" className="text-[10px] h-4 px-1.5">Lead</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.email}</p>
                      <p className="text-[11px] text-muted-foreground">{ROLE_LABELS[m.role]}</p>
                      {metrics && (
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> {metrics.total_resolved}
                          </span>
                          <span className="flex items-center gap-1">
                            <Ticket className="h-3 w-3" /> {metrics.open_cases} open
                          </span>
                          {metrics.satisfaction_score != null && (
                            <span className="flex items-center gap-1 text-yellow-600">
                              <Star className="h-3 w-3" /> {metrics.satisfaction_score.toFixed(1)}
                            </span>
                          )}
                        </div>
                      )}
                      {m.id !== team.lead_user_id && (
                        <div className="mt-2.5 space-y-1.5">
                          {/* SLA bar */}
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="w-[72px] shrink-0">SLA</span>
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  (metrics?.sla_compliance_pct ?? 0) >= 80
                                    ? 'bg-emerald-500'
                                    : (metrics?.sla_compliance_pct ?? 0) >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${metrics?.sla_compliance_pct ?? 0}%` }}
                              />
                            </div>
                            <span className="w-8 text-right shrink-0 tabular-nums">
                              {metrics?.sla_compliance_pct ?? 0}%
                            </span>
                          </div>
                          {/* Satisfaction bar — avg of client feedback ratings (1–5) */}
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="w-[72px] shrink-0">Satisfaction</span>
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    (metrics?.satisfaction_score ?? 0) >= 4
                                      ? 'bg-emerald-500'
                                      : (metrics?.satisfaction_score ?? 0) >= 3
                                      ? 'bg-amber-500'
                                      : metrics?.satisfaction_score != null
                                      ? 'bg-red-500'
                                      : 'bg-muted-foreground/30'
                                  }`}
                                  style={{
                                    width: metrics?.satisfaction_score != null
                                      ? `${((metrics.satisfaction_score - 1) / 4) * 100}%`
                                      : '0%',
                                  }}
                                />
                              </div>
                              <span className="w-14 text-right shrink-0 tabular-nums">
                                {metrics?.satisfaction_score != null
                                  ? `${metrics.satisfaction_score.toFixed(1)} / 5`
                                  : '— / 5'}
                              </span>
                            </div>
                            <div className="pl-[80px] text-[10px] text-muted-foreground/70">
                              {metrics?.total_feedback_count
                                ? `avg of ${metrics.total_feedback_count} rating${metrics.total_feedback_count !== 1 ? 's' : ''}`
                                : 'no ratings yet'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {canManage && m.id !== team.lead_user_id ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                        disabled={removeMutation.isPending || requestMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (isTH) {
                            removeMutation.mutate(m.id)
                          } else {
                            requestMutation.mutate({
                              team_id: id,
                              type: 'remove',
                              requested_by: session.userId,
                              user_ids: [m.id],
                              status: 'pending',
                            })
                          }
                        }}
                        aria-label={isTH ? `Remove ${m.name}` : `Request removal of ${m.name}`}
                        title={isTH ? 'Remove from team' : 'Send remove request to Technical Head'}
                      >
                        {isTH ? <UserMinus className="h-3.5 w-3.5" /> : <ClockIcon className="h-3.5 w-3.5 text-amber-500" />}
                      </Button>
                    ) : (
                      <ChevronRight className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground/0 group-hover:text-primary/60 transition-colors shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Cases panel */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Ticket className="h-4 w-4 text-muted-foreground" />
              Cases <span className="text-sm font-normal text-muted-foreground">({cases.length})</span>
            </h2>
            {canManage && transferableCases.length > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary" onClick={() => setShowTransferCase(true)}>
                <ArrowRightLeft className="h-3 w-3" /> {isTH ? 'Transfer' : 'Request Transfer'}
              </Button>
            )}
          </div>

          {loadingCases ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : cases.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No cases for this team yet.</p>
          ) : (
            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
              {cases.map((c: Case) => {
                const assignee = allUsers.find((u) => u.id === c.assignee_id)
                const resTime = c.resolved_at
                  ? new Date(c.resolved_at).getTime() - new Date(c.created_at).getTime()
                  : null
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border bg-card p-3.5 hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => router.push(`/cases/${c.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-muted-foreground">{c.reference_no}</span>
                        <PriorityChip priority={c.priority} />
                        <StatusBadge status={c.status} />
                        {c.is_escalated && (
                          <Badge variant="destructive" className="text-[10px] h-4 px-1.5 gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" /> Escalated
                          </Badge>
                        )}
                      </div>
                      <SLACountdown createdAt={c.created_at} dueAt={c.sla_due_at} status={c.status} />
                    </div>

                    <p className="text-sm font-medium text-foreground mt-1.5 line-clamp-1">{c.title}</p>

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
                      <span><Clock className="inline h-3 w-3 mr-0.5" />Created {formatDateTime(c.created_at)}</span>
                      {assignee && (
                        <span className="flex items-center gap-1">
                          <UserAvatar name={assignee.name} size="sm" />
                          {assignee.name}
                        </span>
                      )}
                      {resTime != null && (
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Resolved in {formatDuration(resTime)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Manage Engineers Dialog */}
      <ManageEngineersDialog
        open={showManageMembers}
        onClose={() => setShowManageMembers(false)}
        teamName={team.name}
        teamLeadId={team.lead_user_id}
        members={members}
        available={availableEngineers}
        isTH={isTH}
        requestedBy={session.userId}
        onDirectAdd={(uid) => assignMutation.mutate(uid)}
        onDirectRemove={(uid) => removeMutation.mutate(uid)}
        onRequestAdd={(userIds) => requestMutation.mutate({
          team_id: id,
          type: 'add',
          requested_by: session.userId,
          user_ids: userIds,
          status: 'pending',
        })}
        onRequestRemove={(uid) => requestMutation.mutate({
          team_id: id,
          type: 'remove',
          requested_by: session.userId,
          user_ids: [uid],
          status: 'pending',
        })}
        isPending={assignMutation.isPending || removeMutation.isPending || requestMutation.isPending}
      />

      {/* Edit Services Dialog — TH only */}
      <Dialog open={showEditServices} onOpenChange={(o) => !o && setShowEditServices(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Support Services</DialogTitle></DialogHeader>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {(solutions ?? []).filter((s: Solution) => s.is_active).map((s: Solution) => {
              const selected = editServiceIds.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setEditServiceIds((prev) =>
                    prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                  )}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer hover:bg-muted/50 ${selected ? 'bg-primary/5' : ''}`}
                >
                  <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                    {selected && <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">{s.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({s.category})</span>
                  </div>
                </button>
              )
            })}
          </div>
          {editServiceIds.length === 0 && (
            <p className="text-xs text-destructive">Select at least one support service.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditServices(false)}>Cancel</Button>
            <Button
              disabled={editServiceIds.length === 0 || updateServicesMutation.isPending}
              onClick={() => updateServicesMutation.mutate(editServiceIds)}
            >
              {updateServicesMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Case Dialog */}
      <TransferCaseDialog
        open={showTransferCase}
        onClose={() => setShowTransferCase(false)}
        cases={transferableCases}
        teams={otherTeams}
        allUsers={allUsers}
        isTH={isTH}
        teamId={id}
        requestedBy={session.userId}
        onTransfer={(caseId, targetTeamId) => transferMutation.mutate({ caseId, targetTeamId })}
        onRequest={(caseId) => caseTransferRequestMutation.mutate({
          team_id: id,
          case_id: caseId,
          requested_by: session.userId,
          status: 'pending',
        })}
        isPending={transferMutation.isPending || caseTransferRequestMutation.isPending}
      />
    </div>
  )
}

// ── Manage Engineers Dialog ────────────────────────────────────────────────────

function ManageEngineersDialog({
  open, onClose, teamName, teamLeadId, members, available, isTH,
  onDirectAdd, onDirectRemove, onRequestAdd, onRequestRemove, isPending,
}: {
  open: boolean
  onClose: () => void
  teamName: string
  teamLeadId: string
  members: User[]
  available: User[]
  isTH: boolean
  requestedBy: string
  onDirectAdd: (uid: string) => void
  onDirectRemove: (uid: string) => void
  onRequestAdd: (userIds: string[]) => void
  onRequestRemove: (uid: string) => void
  isPending: boolean
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const toggleSelect = (uid: string) =>
    setSelectedIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    )

  const handleSendAddRequest = () => {
    if (selectedIds.length === 0) return
    onRequestAdd(selectedIds)
    setSelectedIds([])
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setSelectedIds([]) } }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Manage Engineers — {teamName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* Current members */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Current Members ({members.length})
            </p>
            {members.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No engineers assigned yet.</p>
            )}
            {members.map((m) => {
              const isLead = m.id === teamLeadId
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
                  <UserAvatar name={m.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                  {isLead ? (
                    <Badge variant="default" className="text-[10px] shrink-0">Lead</Badge>
                  ) : isTH ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      disabled={isPending}
                      onClick={() => onDirectRemove(m.id)}
                    >
                      <X className="h-3 w-3" /> Remove
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 shrink-0"
                      disabled={isPending}
                      onClick={() => onRequestRemove(m.id)}
                    >
                      <ClockIcon className="h-3 w-3" /> Remove Request
                    </Button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Available engineers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Available Engineers ({available.length})
              </p>
              {!isTH && selectedIds.length > 0 && (
                <Button
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  disabled={isPending}
                  onClick={handleSendAddRequest}
                >
                  <ClockIcon className="h-3 w-3" /> Send Add Request ({selectedIds.length})
                </Button>
              )}
            </div>
            {available.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No available engineers to add.</p>
            )}
            {available.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
                {!isTH && (
                  <div
                    className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                      selectedIds.includes(u.id) ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                    }`}
                    onClick={() => toggleSelect(u.id)}
                  >
                    {selectedIds.includes(u.id) && (
                      <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                )}
                <UserAvatar name={u.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  {u.team_id && (
                    <p className="text-[10px] text-amber-600 mt-0.5">Currently in another team</p>
                  )}
                </div>
                {isTH ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 shrink-0"
                    disabled={isPending}
                    onClick={() => onDirectAdd(u.id)}
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                ) : (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground shrink-0 cursor-pointer"
                    onClick={() => toggleSelect(u.id)}
                  >
                    {selectedIds.includes(u.id) ? 'Deselect' : 'Select'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="pt-2">
          {!isTH && selectedIds.length > 0 && (
            <Button
              className="gap-1"
              disabled={isPending}
              onClick={handleSendAddRequest}
            >
              <ClockIcon className="h-3.5 w-3.5" /> Send Add Request ({selectedIds.length})
            </Button>
          )}
          <Button variant="outline" onClick={() => { onClose(); setSelectedIds([]) }}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Transfer Case Dialog ───────────────────────────────────────────────────────

function TransferCaseDialog({
  open, onClose, cases, teams, allUsers, isTH, onTransfer, onRequest, isPending,
}: {
  open: boolean
  onClose: () => void
  cases: Case[]
  teams: Team[]
  allUsers: User[]
  isTH: boolean
  teamId: string
  requestedBy: string
  onTransfer: (caseId: string, targetTeamId: string) => void
  onRequest: (caseId: string) => void
  isPending: boolean
}) {
  const [selections, setSelections] = useState<Record<string, string>>({})

  const setTarget = (caseId: string, teamId: string) =>
    setSelections((prev) => ({ ...prev, [caseId]: teamId }))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            {isTH ? 'Transfer Cases to Another Team' : 'Request Case Transfer'}
          </DialogTitle>
        </DialogHeader>

        {!isTH && (
          <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            As Team Lead, you can send a transfer request for approval by the Technical Head. The destination team will be decided by the Technical Head.
          </p>
        )}

        {cases.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No transferable cases in this team.</p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {isTH && (
              <p className="text-xs text-muted-foreground">
                Select a destination team for each case, then click Transfer.
              </p>
            )}
            {cases.map((c) => {
              const assignee = allUsers.find((u) => u.id === c.assignee_id)
              const target = selections[c.id] ?? ''
              return (
                <div key={c.id} className="rounded-xl border bg-card p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="text-[10px] font-mono text-muted-foreground">{c.reference_no}</span>
                    <PriorityChip priority={c.priority} />
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-sm font-medium text-foreground line-clamp-1">{c.title}</p>
                  {assignee && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <UserAvatar name={assignee.name} size="sm" />
                      <span>Assigned to {assignee.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Select
                      value={target}
                      onValueChange={(v) => setTarget(c.id, v)}
                      disabled={!isTH}
                    >
                      <SelectTrigger className={`flex-1 h-8 text-xs ${!isTH ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <SelectValue placeholder={isTH ? 'Select destination team…' : 'Destination decided by Technical Head'} />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((t) => (
                          <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isTH ? (
                      <Button
                        size="sm"
                        className="h-8 gap-1 shrink-0"
                        disabled={!target || isPending}
                        onClick={() => {
                          onTransfer(c.id, target)
                          setSelections((prev) => { const n = { ...prev }; delete n[c.id]; return n })
                        }}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 shrink-0 text-amber-600 border-amber-400 hover:bg-amber-50"
                        disabled={isPending}
                        onClick={() => onRequest(c.id)}
                      >
                        <ClockIcon className="h-3.5 w-3.5" /> Send Request
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  )
}

function TeamDetailSkeleton({ onBack, showBack }: { onBack: () => void; showBack: boolean }) {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {showBack && (
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back to Teams
        </Button>
      )}
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    </div>
  )
}