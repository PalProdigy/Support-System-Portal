'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { ReactNode } from 'react'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { UserAvatar } from '@/components/shared/user-avatar'
import { StatusBadge } from '@/components/shared/status-badge'
import { PriorityChip } from '@/components/shared/priority-chip'
import { ErrorState } from '@/components/shared/error-state'
import { SearchableSelect } from '@/components/shared/searchable-select'
import { TeamMonthlyActivity } from '@/modules/teams/team-monthly-activity'
import { useIsTouchDevice } from '@/hooks/use-touch-device'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { ROLE_LABELS } from '@/lib/rbac'
import { cn, formatDateTime, formatDuration, formatDate, STATUS_LABELS } from '@/lib/utils'
import {
  ArrowLeft, Headset, Users, CheckCircle2, Clock,
  Star, AlertTriangle, Ticket, Crown,
  UserPlus, ArrowRightLeft, Plus, X, Search,
  ClockIcon, CheckCircle, XCircle, ChevronRight,
  LayoutGrid, MessageSquare, Settings as SettingsIcon, Power, Award, BadgeCheck, Mail,
} from 'lucide-react'
import type { Case, User, EngineerMetrics, Team, CaseTransferRequest, Solution, Client } from '@/types'

const TEAM_TABS = ['overview', 'members', 'cases', 'feedback', 'settings']

const TEAM_TAB_TRIGGER_CLASS = cn(
  'flex flex-col items-center justify-center gap-1 min-h-10 min-w-0 py-2 sm:py-0 px-0.5 rounded-[10px]',
  'text-[11px] leading-tight whitespace-nowrap text-muted-foreground',
  'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
  'active:opacity-60'
)

/**
 * Full team workspace — header, KPIs, performance charts, members, and
 * cases. Shared by the /teams/[id] route (team_lead / technical_head, with
 * management actions) and the /team route (a support engineer's read-only
 * view of their own team), so both stay in sync automatically.
 */
export function TeamDetail({ teamId }: { teamId: string }) {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }
  const isTH = session.role === 'technical_head'
  const isTouchDevice = useIsTouchDevice()

  const [showManageMembers, setShowManageMembers] = useState(false)
  const [transferCase, setTransferCase] = useState<Case | null>(null)
  const [showEditServices, setShowEditServices] = useState(false)
  const [editServiceIds, setEditServiceIds] = useState<string[]>([])
  const [editServiceQuery, setEditServiceQuery] = useState('')
  const [showChangeLead, setShowChangeLead] = useState(false)
  const [newLeadId, setNewLeadId] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [activeTab, setActiveTabState] = useState<string>(() => {
    const t = searchParams.get('tab')
    return t && TEAM_TABS.includes(t) ? t : 'overview'
  })
  // Keep the URL's ?tab= query param in sync so a specific tab can be linked
  // to directly (e.g. /teams/1?tab=cases) and stays intact on reload.
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [caseStatusFilter, setCaseStatusFilter] = useState<'all' | 'active' | 'escalated' | 'resolved'>('all')
  const [caseSearch, setCaseSearch] = useState('')

  const { data: team, isLoading: loadingTeam, error } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => dp.getTeam(teamId),
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
    queryKey: ['cases', 'team', teamId],
    queryFn: () => dp.listCases(scope, { team_id: teamId, pageSize: 500 }),
    enabled: !!team,
  })

  const { data: allMetrics } = useQuery({
    queryKey: ['engineer-metrics-all'],
    queryFn: () => dp.listAllEngineerMetrics(scope),
    enabled: !!team,
  })

  // listAllEngineerMetrics only covers support_engineer role — fetch the team
  // lead's own case-handling stats separately so their member card isn't blank.
  const { data: leadMetrics } = useQuery({
    queryKey: ['engineer-metrics', team?.lead_user_id],
    queryFn: () => dp.getEngineerMetrics(team!.lead_user_id!, scope),
    enabled: !!team?.lead_user_id,
  })

  const { data: memberRequests } = useQuery({
    queryKey: ['team-member-requests', teamId],
    queryFn: () => dp.listTeamMemberRequests(teamId),
    enabled: !!team,
  })

  const { data: caseTransferRequests } = useQuery({
    queryKey: ['case-transfer-requests', teamId],
    queryFn: () => dp.listCaseTransferRequests(teamId),
    enabled: !!team,
  })

  const { data: feedback } = useQuery({
    queryKey: ['feedback', 'team', teamId],
    queryFn: () => dp.listFeedback(scope),
    enabled: !!team,
  })

  const { data: clients } = useQuery({
    queryKey: ['clients', 'team', teamId],
    queryFn: () => dp.listClients(scope),
    enabled: !!team,
  })

  // Mutation: assign engineer to this team (technical_head only)
  const assignMutation = useMutation({
    mutationFn: (userId: string) => dp.updateUser(userId, { team_id: teamId }),
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

  // Mutation: move engineer directly to another team (technical_head only)
  const transferMemberMutation = useMutation({
    mutationFn: ({ userId, targetTeamId }: { userId: string; targetTeamId: string }) =>
      dp.updateUser(userId, { team_id: targetTeamId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Engineer transferred to new team', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to transfer engineer', variant: 'destructive' }),
  })

  // Mutation: submit a case transfer request (team_lead)
  const caseTransferRequestMutation = useMutation({
    mutationFn: (input: Omit<CaseTransferRequest, 'id' | 'created_at'>) =>
      dp.createCaseTransferRequest(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['case-transfer-requests', teamId] })
      qc.invalidateQueries({ queryKey: ['case-transfer-requests', 'all-pending'] })
      toast({ title: 'Transfer request sent to Technical Head', variant: 'success' })
      setTransferCase(null)
    },
    onError: () => toast({ title: 'Failed to send transfer request', variant: 'destructive' }),
  })

  // Mutation: resolve a case transfer request (technical_head — approve/reject)
  const resolveCaseTransferMutation = useMutation({
    mutationFn: ({ reqId, status }: { reqId: string; status: 'approved' | 'rejected' }) =>
      dp.updateCaseTransferRequest(reqId, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['case-transfer-requests', teamId] })
      qc.invalidateQueries({ queryKey: ['case-transfer-requests', 'all-pending'] })
      toast({ title: 'Transfer request updated', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to update transfer request', variant: 'destructive' }),
  })

  // Mutation: approve a request (technical_head)
  const approveMutation = useMutation({
    mutationFn: (reqId: string) => dp.approveTeamMemberRequest(reqId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-member-requests', teamId] })
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
      qc.invalidateQueries({ queryKey: ['team-member-requests', teamId] })
      qc.invalidateQueries({ queryKey: ['team-member-requests', 'all-pending'] })
      toast({ title: 'Request rejected', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to reject request', variant: 'destructive' }),
  })

  // Mutation: update team support services (technical_head only)
  const updateServicesMutation = useMutation({
    mutationFn: (solution_ids: string[]) => dp.updateTeam(teamId, { solution_ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team', teamId] })
      qc.invalidateQueries({ queryKey: ['teams'] })
      toast({ title: 'Support services updated', variant: 'success' })
      setShowEditServices(false)
    },
    onError: () => toast({ title: 'Failed to update services', variant: 'destructive' }),
  })

  // Mutation: change team lead (technical_head only). The new lead's team_id
  // is set to this team so their own dashboard scopes correctly; the outgoing
  // lead's team_id is cleared since they no longer belong to this team.
  const changeLeadMutation = useMutation({
    mutationFn: async (leadId: string) => {
      await dp.updateTeam(teamId, { lead_user_id: leadId })
      await dp.updateUser(leadId, { team_id: teamId })
      if (team?.lead_user_id && team.lead_user_id !== leadId) {
        await dp.updateUser(team.lead_user_id, { team_id: undefined })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team', teamId] })
      qc.invalidateQueries({ queryKey: ['teams'] })
      qc.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Team lead changed', variant: 'success' })
      setShowChangeLead(false)
    },
    onError: () => toast({ title: 'Failed to change team lead', variant: 'destructive' }),
  })

  // Mutation: toggle team active/inactive status (technical_head only)
  const toggleActiveMutation = useMutation({
    mutationFn: () => dp.updateTeam(teamId, { is_active: !(team?.is_active ?? true) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team', teamId] })
      qc.invalidateQueries({ queryKey: ['teams'] })
      toast({ title: team?.is_active === false ? 'Team activated' : 'Team deactivated', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to update team status', variant: 'destructive' }),
  })

  // Mutation: rename team (technical_head only)
  const renameTeamMutation = useMutation({
    mutationFn: (name: string) => dp.updateTeam(teamId, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team', teamId] })
      qc.invalidateQueries({ queryKey: ['teams'] })
      toast({ title: 'Team name updated', variant: 'success' })
      setEditingName(false)
    },
    onError: () => toast({ title: 'Failed to update team name', variant: 'destructive' }),
  })

  // Mutation: transfer case to another team
  const transferMutation = useMutation({
    mutationFn: ({ caseId, targetTeamId }: { caseId: string; targetTeamId: string }) =>
      dp.updateCase(caseId, { team_id: targetTeamId, assignee_id: undefined }, scope),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases', 'team', teamId] })
      qc.invalidateQueries({ queryKey: ['cases'] })
      toast({ title: 'Case transferred to new team', variant: 'success' })
      setTransferCase(null)
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
  const members = allUsers.filter((u) => u.team_id === teamId)
  const lead = allUsers.find((u) => u.id === team.lead_user_id)
  const potentialLeads = allUsers.filter((u) => ['team_lead', 'technical_head'].includes(u.role) && u.is_active)

  const availableEngineers = allUsers.filter(
    (u) => u.role === 'support_engineer' && u.team_id !== teamId && u.is_active
  )

  const cases: Case[] = casesPage?.items ?? []
  const resolvedCases = cases.filter((c) => ['resolved', 'pending_closure', 'closed'].includes(c.status))
  const openCases = cases.filter((c) => !['resolved', 'pending_closure', 'closed'].includes(c.status))
  const escalatedCases = cases.filter((c) => c.is_escalated || c.status === 'escalated')

  // When a member is selected on the roster, scope the Cases panel to just
  // that engineer's own cases (active + resolved) instead of the whole team.
  const selectedMember = selectedMemberId ? members.find((m) => m.id === selectedMemberId) ?? null : null
  const displayedCases = selectedMember ? cases.filter((c) => c.assignee_id === selectedMember.id) : cases
  const displayedOpenCases = selectedMember ? displayedCases.filter((c) => openCases.includes(c)) : openCases
  const displayedResolvedCases = selectedMember ? displayedCases.filter((c) => resolvedCases.includes(c)) : resolvedCases
  const displayedEscalatedCases = displayedCases.filter((c) => c.is_escalated || c.status === 'escalated')

  const caseSearchLower = caseSearch.trim().toLowerCase()
  const filteredCases = displayedCases
    .filter((c) => {
      if (caseStatusFilter === 'active') return displayedOpenCases.includes(c)
      if (caseStatusFilter === 'escalated') return displayedEscalatedCases.includes(c)
      if (caseStatusFilter === 'resolved') return displayedResolvedCases.includes(c)
      return true
    })
    .filter((c) => !caseSearchLower || c.reference_no.toLowerCase().includes(caseSearchLower) || c.title.toLowerCase().includes(caseSearchLower))

  const otherTeams = (allTeams ?? []).filter((t: Team) => t.id !== teamId)

  // Case status breakdown — composition of this team's caseload across the pipeline.
  const statusColors: Record<Case['status'], string> = {
    new: '#3b82f6',
    triaged: '#8b5cf6',
    assigned: '#06b6d4',
    in_progress: '#f59e0b',
    pending_client: '#f97316',
    resolved: '#10b981',
    pending_closure: '#14b8a6',
    closed: '#64748b',
    escalated: '#ef4444',
  }
  const statusCounts = cases.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1
    return acc
  }, {} as Record<Case['status'], number>)
  const statusData = (Object.keys(statusCounts) as Case['status'][])
    .map((status) => ({ name: STATUS_LABELS[status], value: statusCounts[status], color: statusColors[status] }))
    .filter((d) => d.value > 0)

  const metricsMap: Record<string, EngineerMetrics> = Object.fromEntries(
    (allMetrics ?? []).map((m: EngineerMetrics) => [m.engineer_id, m])
  )
  if (team.lead_user_id && leadMetrics) {
    metricsMap[team.lead_user_id] = leadMetrics
  }

  const memberSatisfactions = members
    .map((m) => metricsMap[m.id]?.satisfaction_score)
    .filter((s): s is number => s != null)
  const avgSatisfaction = memberSatisfactions.length > 0
    ? memberSatisfactions.reduce((a, b) => a + b, 0) / memberSatisfactions.length
    : null

  const canManage = ['team_lead', 'technical_head'].includes(session.role)

  const pendingMemberRequests = (memberRequests ?? []).filter((r) => r.status === 'pending')
  const pendingTransferRequests = (caseTransferRequests ?? []).filter((r) => r.status === 'pending')
  const totalPending = pendingMemberRequests.length + pendingTransferRequests.length
  const usersMap = Object.fromEntries(allUsers.map((u) => [u.id, u]))
  const casesMap = Object.fromEntries(cases.map((c) => [c.id, c]))
  const solutionsMap = Object.fromEntries((solutions ?? []).map((s: Solution) => [s.id, s]))
  const clientsMap = Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c]))
  const teamSolutions = (team.solution_ids ?? []).map((id) => solutionsMap[id]).filter(Boolean) as Solution[]

  // Feedback tab: Feedback has no direct team_id, so join through this team's own cases.
  const teamFeedback = (feedback ?? []).filter((f) => casesMap[f.case_id])
  const feedbackRatings = teamFeedback.map((f) => f.rating).filter((r): r is number => r != null)
  const avgFeedbackRating = feedbackRatings.length > 0
    ? feedbackRatings.reduce((a, b) => a + b, 0) / feedbackRatings.length
    : null
  const feedbackRatingCounts = [5, 4, 3, 2, 1].map((n) => ({ n, count: feedbackRatings.filter((r) => r === n).length }))
  const maxFeedbackRatingCount = Math.max(1, ...feedbackRatingCounts.map((r) => r.count))

  const PRIORITY_BAR: Record<Case['priority'], string> = {
    low: 'bg-slate-300', medium: 'bg-sky-400', high: 'bg-orange-400', critical: 'bg-red-500',
  }

  const renderCaseCard = (c: Case) => {
    const assignee = allUsers.find((u) => u.id === c.assignee_id)
    const coAssignees = (c.co_assignee_ids ?? []).map((uid) => allUsers.find((u) => u.id === uid)).filter((u): u is User => !!u)
    const resTime = c.resolved_at
      ? new Date(c.resolved_at).getTime() - new Date(c.created_at).getTime()
      : null
    return (
      <div
        key={c.id}
        className="group flex items-stretch gap-0 rounded-xl border bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
        onClick={() => router.push(`/cases/${c.id}`)}
      >
        <div className={cn('w-1 shrink-0', PRIORITY_BAR[c.priority])} />
        <div className="flex-1 min-w-0 flex items-center gap-4 flex-wrap px-4 py-3.5">
          <div className="flex-1 min-w-[220px]">
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
            <p className="text-sm font-medium text-foreground mt-1.5 truncate group-hover:text-primary transition-colors">{c.title}</p>
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
              <span><Clock className="inline h-3 w-3 mr-0.5" />Created {formatDateTime(c.created_at)}</span>
              {assignee && (
                <span className="flex items-center gap-1 rounded-full bg-primary/10 pl-0.5 pr-2 py-0.5">
                  <UserAvatar name={assignee.name} size="sm" />
                  <span className="text-foreground font-medium">{assignee.name}</span>
                  <span className="text-[9px] font-semibold text-primary uppercase tracking-wide">Primary</span>
                </span>
              )}
              {coAssignees.map((u) => (
                <span key={u.id} className="flex items-center gap-1 rounded-full bg-violet-500/10 pl-0.5 pr-2 py-0.5">
                  <UserAvatar name={u.name} size="sm" />
                  <span className="text-foreground font-medium">{u.name}</span>
                  <span className="text-[9px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Supporting</span>
                </span>
              ))}
              {resTime != null && (
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="h-3 w-3" /> Resolved in {formatDuration(resTime)}
                </span>
              )}
            </div>
          </div>
          {canManage && c.status !== 'closed' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] px-2.5 gap-1 shrink-0"
              onClick={(e) => { e.stopPropagation(); setTransferCase(c) }}
            >
              <ArrowRightLeft className="h-3 w-3" /> Transfer
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="  pb-6 pt-4 max-w-6xl">
      {isTH && (
        <Button variant="ghost" className="pb-2 pl-6" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back to Teams
        </Button>
      )}
      <div className=" px-6 mx-auto space-y-6">

      {/* Team header — modern gradient hero */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 flex items-start gap-4 flex-wrap">
        <div className="rounded-xl bg-primary/15 p-3 shrink-0">
          <Headset className="h-7 w-7 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{team.name}</h1>
            {team.is_active === false
              ? <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-zinc-800 text-zinc-100 hover:bg-zinc-800">Deactive</Badge>
              : <Badge variant="default" className="text-[10px] h-5 px-1.5 bg-emerald-500 hover:bg-emerald-500 text-white">Active</Badge>
            }
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {lead ? (
              <div
                className="flex items-center gap-1.5 cursor-pointer w-fit hover:opacity-75 transition-opacity"
                onClick={() => router.push(`/users/${lead.id}`)}
              >
                <Crown className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{lead.name}</span>
                  <span className="ml-1 text-xs">· {ROLE_LABELS[lead.role]}</span>
                </span>
              </div>
            ) : isTH && (
              <span className="text-sm text-muted-foreground italic">No lead assigned</span>
            )}
            {isTH && (
              <button
                type="button"
                className="text-[11px] text-primary hover:underline cursor-pointer"
                onClick={() => { setNewLeadId(lead?.id ?? ''); setShowChangeLead(true) }}
              >
                {lead ? 'Change' : 'Assign lead'}
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Created {formatDateTime(team.created_at)}
          </p>
        </div>
        {/* Action buttons — engineer/service management is technical_head only;
            team_lead has read-only visibility into their team's roster. */}
        {isTH && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => { setEditServiceIds(team.solution_ids ?? []); setShowEditServices(true) }}>
              Services
            </Button>
            <div className="relative">
              <Button size="sm" variant="outline" onClick={() => setShowManageMembers(true)}>
                <UserPlus className="h-3.5 w-3.5" /> Manage Engineers
              </Button>
              {totalPending > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                </span>
              )}
            </div>
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

      {/* Team workspace tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList className="h-auto w-full grid grid-cols-5 gap-1 p-1.5 bg-card rounded-[14px] border border-border [-webkit-tap-highlight-color:transparent]">
          <TabsTrigger value="overview" className={TEAM_TAB_TRIGGER_CLASS}><LayoutGrid className="h-[18px] w-[18px]" /> Overview</TabsTrigger>
          <TabsTrigger value="members" className={TEAM_TAB_TRIGGER_CLASS}><Users className="h-[18px] w-[18px]" /> Members</TabsTrigger>
          <TabsTrigger value="cases" className={TEAM_TAB_TRIGGER_CLASS}><Ticket className="h-[18px] w-[18px]" /> Cases</TabsTrigger>
          <TabsTrigger value="feedback" className={TEAM_TAB_TRIGGER_CLASS}><MessageSquare className="h-[18px] w-[18px]" /> Feedback</TabsTrigger>
          <TabsTrigger value="settings" className={TEAM_TAB_TRIGGER_CLASS}><SettingsIcon className="h-[18px] w-[18px]" /> Settings</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard icon={<Ticket className="h-5 w-5 text-blue-500" />} label="Total Cases" value={String(cases.length)} />
            <KpiCard icon={<AlertTriangle className="h-5 w-5 text-amber-500" />} label="Open Cases" value={String(openCases.length)} />
            <KpiCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} label="Resolved" value={String(resolvedCases.length)} />
            <KpiCard icon={<AlertTriangle className="h-5 w-5 text-red-500" />} label="Escalated" value={String(escalatedCases.length)} />
            <KpiCard icon={<Users className="h-5 w-5 text-violet-500" />} label="Team Members" value={String(members.length)} />
            <KpiCard
              icon={<Star className="h-5 w-5 text-yellow-500" />}
              label="Team Satisfaction"
              value={avgSatisfaction != null ? `${avgSatisfaction.toFixed(1)} / 5` : '—'}
            />
          </div>

          {(statusData.length > 0 || cases.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {statusData.length > 0 && (
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold">Case Status Breakdown</p>
                    <p className="text-xs text-muted-foreground">Composition of this team&apos;s caseload by status</p>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        trigger={isTouchDevice ? 'click' : 'hover'}
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

              <TeamMonthlyActivity cases={cases} />
            </div>
          )}
        </TabsContent>

        {/* Members */}
        <TabsContent value="members" className="space-y-3 mt-0">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Members <span className="text-sm font-normal text-muted-foreground">({members.length})</span>
            </h2>
            {isTH && (
              <div className="relative">
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary" onClick={() => setShowManageMembers(true)}>
                  <Plus className="h-3 w-3" /> Manage
                </Button>
                {totalPending > 0 && (
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {members.map((m) => {
                const metrics = metricsMap[m.id]
                const isLeadCard = m.id === team.lead_user_id
                const isSelected = selectedMemberId === m.id
                // A support engineer can't navigate to a teammate's full profile
                // page, but everyone can still select a card to filter the Cases panel.
                const canNavigate = session.role !== 'support_engineer'
                const memberHref = isLeadCard && session.role === 'team_lead'
                  ? '/dashboard'
                  : m.role === 'support_engineer' || m.role === 'team_lead' ? `/engineer/${m.id}`
                  : `/users/${m.id}`
                const toggleSelect = () => setSelectedMemberId((prev) => {
                  const next = prev === m.id ? null : m.id
                  if (next) setActiveTab('cases')
                  return next
                })
                const certCount = m.certifications?.length ?? 0
                return (
                  <div
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={isSelected ? `Clear case filter for ${m.name}` : `Show ${m.name}'s cases`}
                    className={cn(
                      'relative rounded-xl border bg-card p-4 flex items-start gap-3',
                      'group transition-all cursor-pointer hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                      isSelected && 'border-primary bg-primary/5 ring-1 ring-primary/30',
                      isLeadCard && 'border-amber-400/40'
                    )}
                    onClick={toggleSelect}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleSelect()
                      }
                    }}
                  >
                    <div className="relative shrink-0">
                      <UserAvatar name={m.name} avatarUrl={m.avatar} userId={m.id} size="md" />
                      {isLeadCard && (
                        <Crown className="absolute -top-1.5 -right-1.5 h-4 w-4 text-amber-500 fill-amber-400 drop-shadow" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pr-5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={cn('text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate', isSelected && 'text-primary')}>
                          {m.name}
                        </p>
                        {isSelected && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-primary text-primary shrink-0">
                            Showing cases
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">{ROLE_LABELS[m.role]}</Badge>
                        {isLeadCard && m.role !== 'team_lead' && (
                          <Badge variant="default" className="text-[10px] h-4 px-1.5 bg-amber-500 hover:bg-amber-500 text-white">Team Lead</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 shrink-0" /> {m.email}
                      </p>
                      {(m.certification_level || certCount > 0) && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {m.certification_level && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                              <BadgeCheck className="h-3 w-3" /> {m.certification_level}
                            </span>
                          )}
                          {certCount > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {certCount} certificate{certCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}
                      {metrics && (
                        <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t text-[11px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> {metrics.total_resolved} resolved
                          </span>
                          <span className="flex items-center gap-1">
                            <Ticket className="h-3 w-3" /> {metrics.open_cases} open
                          </span>
                          <span className="flex items-center gap-1 text-yellow-600">
                            <Star className="h-3 w-3" />
                            {metrics.satisfaction_score != null ? metrics.satisfaction_score.toFixed(1) : '—'}
                            {metrics.total_feedback_count > 0 && ` (${metrics.total_feedback_count})`}
                          </span>
                          <span className="flex items-center gap-1 text-violet-600 font-semibold">
                            <Award className="h-3 w-3" /> {metrics.points} pts
                          </span>
                        </div>
                      )}
                    </div>
                    {canNavigate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 absolute right-3 top-3 text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-primary transition-colors"
                        onClick={(e) => { e.stopPropagation(); router.push(memberHref) }}
                        aria-label={isLeadCard && session.role === 'team_lead' ? 'Go to your dashboard' : `View ${m.name}'s profile`}
                        title="View profile"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Cases */}
        <TabsContent value="cases" className="space-y-4 mt-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-base font-semibold flex items-center gap-2 min-w-0">
              <Ticket className="h-4 w-4 text-muted-foreground shrink-0" />
              {selectedMember ? (
                <span className="flex items-center gap-1.5 min-w-0">
                  <UserAvatar name={selectedMember.name} size="sm" />
                  <span className="truncate">{selectedMember.name}&apos;s Cases</span>
                  <span className="text-sm font-normal text-muted-foreground shrink-0">({displayedCases.length})</span>
                </span>
              ) : (
                <>
                  Cases <span className="text-sm font-normal text-muted-foreground">({cases.length})</span>
                </>
              )}
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              {selectedMember && (
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setSelectedMemberId(null)}>
                  <X className="h-3 w-3" /> Clear filter
                </Button>
              )}
            </div>
          </div>

          {loadingCases ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : displayedCases.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              {selectedMember ? `No cases assigned to ${selectedMember.name}.` : 'No cases for this team yet.'}
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 shrink-0">
                  {([
                    { key: 'all', label: 'All', count: displayedCases.length },
                    { key: 'active', label: 'Active', count: displayedOpenCases.length },
                    { key: 'escalated', label: 'Escalated', count: displayedEscalatedCases.length },
                    { key: 'resolved', label: 'Resolved', count: displayedResolvedCases.length },
                  ] as const).map(({ key, label, count }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCaseStatusFilter(key)}
                      className={cn(
                        'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                        caseStatusFilter === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {label} <span className="tabular-nums opacity-70">({count})</span>
                    </button>
                  ))}
                </div>
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    value={caseSearch}
                    onChange={(e) => setCaseSearch(e.target.value)}
                    placeholder="Search reference # or title…"
                    className="h-8 w-full rounded-lg border bg-transparent pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                </div>
              </div>

              {filteredCases.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-6 text-center">No cases match this filter.</p>
              ) : (
                <div className="space-y-2.5">
                  {filteredCases.map((c: Case) => renderCaseCard(c))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Feedback — joined through this team's own cases (Feedback has no direct team_id) */}
        <TabsContent value="feedback" className="space-y-4 mt-0">
          {teamFeedback.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No feedback for this team yet.</p>
          ) : (
            <>
              <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="flex items-center gap-4 shrink-0">
                  <div className="rounded-xl bg-yellow-500/15 p-3">
                    <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground">
                      {avgFeedbackRating != null ? avgFeedbackRating.toFixed(1) : '—'}
                      <span className="text-base font-normal text-muted-foreground"> / 5</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {teamFeedback.length} response{teamFeedback.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex-1 w-full space-y-1">
                  {feedbackRatingCounts.map(({ n, count }) => (
                    <div key={n} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="w-8 shrink-0 flex items-center gap-0.5">{n} <Star className="h-2.5 w-2.5 fill-current" /></span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-yellow-400 transition-all" style={{ width: `${(count / maxFeedbackRatingCount) * 100}%` }} />
                      </div>
                      <span className="w-4 text-right tabular-nums shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                {teamFeedback.map((f) => {
                  const client = clientsMap[f.client_id]
                  const relatedCase = casesMap[f.case_id]
                  const engineer = relatedCase?.assignee_id ? usersMap[relatedCase.assignee_id] : undefined
                  return (
                    <div
                      key={f.id}
                      className="rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => relatedCase && router.push(`/cases/${relatedCase.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{client?.company_name ?? 'Unknown client'}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {f.ml_reviewed && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Lead reviewed
                            </span>
                          )}
                          {f.th_reviewed && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                              <CheckCircle2 className="h-2.5 w-2.5" /> TH reviewed
                            </span>
                          )}
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star key={n} className={cn('h-3.5 w-3.5', f.rating && n <= f.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed mt-2">{f.feedback_text}</p>
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t text-xs text-muted-foreground flex-wrap">
                        {relatedCase && <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">{relatedCase.reference_no}</span>}
                        {engineer && <span className="flex items-center gap-1"><UserAvatar name={engineer.name} size="sm" />{engineer.name}</span>}
                        <span className="ml-auto">{formatDate(f.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="space-y-4 mt-0 max-w-full">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Team Name</p>
              {isTH && !editingName && (
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary" onClick={() => { setNameInput(team.name); setEditingName(true) }}>
                  Edit
                </Button>
              )}
            </div>
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="h-9"
                  autoFocus
                  maxLength={80}
                />
                <Button
                  size="sm"
                  disabled={!nameInput.trim() || renameTeamMutation.isPending}
                  onClick={() => renameTeamMutation.mutate(nameInput.trim())}
                >
                  {renameTeamMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingName(false)}>Cancel</Button>
              </div>
            ) : (
              <p className="text-sm text-foreground">{team.name}</p>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold">Team Status</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {team.is_active === false ? 'This team is deactivated and hidden from active workflows.' : 'This team is active.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {team.is_active === false
                ? <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-zinc-800 text-zinc-100 hover:bg-zinc-800">Deactive</Badge>
                : <Badge variant="default" className="text-[10px] h-5 px-1.5 bg-emerald-500 hover:bg-emerald-500 text-white">Active</Badge>
              }
              {isTH && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={toggleActiveMutation.isPending}
                  onClick={() => toggleActiveMutation.mutate()}
                >
                  <Power className="h-3.5 w-3.5" /> {team.is_active === false ? 'Activate' : 'Deactivate'}
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Team Lead</p>
              {isTH && (
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary" onClick={() => { setNewLeadId(lead?.id ?? ''); setShowChangeLead(true) }}>
                  {lead ? 'Change' : 'Assign lead'}
                </Button>
              )}
            </div>
            {lead ? (
              <div className="flex items-center gap-2.5">
                <UserAvatar name={lead.name} avatarUrl={lead.avatar} userId={lead.id} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[lead.role]}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No lead assigned.</p>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Support Services</p>
              {isTH && (
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary" onClick={() => { setEditServiceIds(team.solution_ids ?? []); setShowEditServices(true) }}>
                  Edit
                </Button>
              )}
            </div>
            {teamSolutions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No support services assigned.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {teamSolutions.map((s) => (
                  <Badge key={s.id} variant="outline" className="text-xs font-normal">{s.name}</Badge>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Manage Engineers Dialog */}
      <ManageEngineersDialog
        open={showManageMembers}
        onClose={() => setShowManageMembers(false)}
        teamName={team.name}
        teamLeadId={team.lead_user_id}
        members={members}
        available={availableEngineers}
        otherTeams={otherTeams}
        isTH={isTH}
        onDirectAdd={(uid) => assignMutation.mutate(uid)}
        onDirectRemove={(uid) => removeMutation.mutate(uid)}
        onDirectTransfer={(uid, targetTeamId) => transferMemberMutation.mutate({ userId: uid, targetTeamId })}
        isPending={assignMutation.isPending || removeMutation.isPending || transferMemberMutation.isPending}
      />

      {/* Edit Services Dialog — TH only */}
      <Dialog open={showEditServices} onOpenChange={(o) => { setShowEditServices(o); if (!o) setEditServiceQuery('') }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Edit Support Services
              {editServiceIds.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">({editServiceIds.length} selected)</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border overflow-hidden">
            <div className="flex items-center gap-2 border-b px-3 py-2 bg-muted/20">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={editServiceQuery}
                onChange={(e) => setEditServiceQuery(e.target.value)}
                placeholder="Search services…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-56 overflow-y-auto p-1">
              {(solutions ?? [])
                .filter((s: Solution) => s.is_active)
                .filter((s: Solution) => s.name.toLowerCase().includes(editServiceQuery.toLowerCase()) || s.category.toLowerCase().includes(editServiceQuery.toLowerCase()))
                .map((s: Solution) => {
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

      {/* Change Team Lead Dialog — technical_head only */}
      <Dialog open={showChangeLead} onOpenChange={(o) => { setShowChangeLead(o); if (!o) setNewLeadId('') }}>
        <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
          {/* Hero header */}
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-5">
            <DialogHeader className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/15 p-2.5 shrink-0">
                  <Crown className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle>{lead ? 'Change Team Lead' : 'Assign Team Lead'}</DialogTitle>
                  <DialogDescription>{team.name}</DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4">
            {lead && (
              <div className="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-3 py-2.5">
                <UserAvatar name={lead.name} avatarUrl={lead.avatar} userId={lead.id} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Current Lead</p>
                  <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
                </div>
              </div>
            )}
            <SearchableSelect
              label="New Team Lead"
              required
              options={potentialLeads.map((u) => ({ id: u.id, label: u.name, sublabel: ROLE_LABELS[u.role], avatarUrl: u.avatar ?? '' }))}
              value={newLeadId}
              onChange={setNewLeadId}
              placeholder="Select lead"
              searchPlaceholder="Search leads…"
              emptyText="No matching leads"
            />
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setShowChangeLead(false)}>Cancel</Button>
            <Button
              className="gap-1.5"
              disabled={!newLeadId || newLeadId === lead?.id || changeLeadMutation.isPending}
              onClick={() => changeLeadMutation.mutate(newLeadId)}
            >
              {changeLeadMutation.isPending ? 'Saving…' : (<><Crown className="h-4 w-4" /> Save</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Case Dialog */}
      <TransferCaseDialog
        open={!!transferCase}
        onClose={() => setTransferCase(null)}
        cases={transferCase ? [transferCase] : []}
        teams={otherTeams}
        allUsers={allUsers}
        isTH={isTH}
        teamId={teamId}
        requestedBy={session.userId}
        onTransfer={(caseId, targetTeamId) => transferMutation.mutate({ caseId, targetTeamId })}
        onRequest={(caseId) => caseTransferRequestMutation.mutate({
          team_id: teamId,
          case_id: caseId,
          requested_by: session.userId,
          status: 'pending',
        })}
        isPending={transferMutation.isPending || caseTransferRequestMutation.isPending}
      />
    </div>
</div>
  )
}

// ── Manage Engineers Dialog ────────────────────────────────────────────────────

function ManageEngineersDialog({
  open, onClose, teamName, teamLeadId, members, available, otherTeams, isTH,
  onDirectAdd, onDirectRemove, onDirectTransfer, isPending,
}: {
  open: boolean
  onClose: () => void
  teamName: string
  teamLeadId: string
  members: User[]
  available: User[]
  otherTeams: Team[]
  isTH: boolean
  onDirectAdd: (uid: string) => void
  onDirectRemove: (uid: string) => void
  onDirectTransfer: (uid: string, targetTeamId: string) => void
  isPending: boolean
}) {
  const [transferringId, setTransferringId] = useState<string | null>(null)
  const [transferTargetId, setTransferTargetId] = useState('')

  const startTransfer = (uid: string) => { setTransferringId(uid); setTransferTargetId('') }
  const confirmTransfer = () => {
    if (!transferringId || !transferTargetId) return
    onDirectTransfer(transferringId, transferTargetId)
    setTransferringId(null)
    setTransferTargetId('')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setTransferringId(null) } }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <div className="text-[16px] sm:text-lg">Manage Engineers — {teamName}</div>
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
              const isTransferring = transferringId === m.id
              return (
                <div key={m.id} className="rounded-lg border bg-card px-3 py-2.5 space-y-2">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={m.name} avatarUrl={m.avatar} userId={m.id} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    {isLead ? (
                      <Badge variant="default" className="text-[10px] shrink-0">Lead</Badge>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        {isTH && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 shrink-0"
                            disabled={isPending || otherTeams.length === 0}
                            onClick={() => startTransfer(m.id)}
                          >
                            <ArrowRightLeft className="h-3 w-3" /> Transfer
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                          disabled={isPending}
                          onClick={() => onDirectRemove(m.id)}
                        >
                          <X className="h-3 w-3" /> Remove
                        </Button>
                      </div>
                    )}
                  </div>
                  {isTransferring && (
                    <div className="flex items-center gap-2 pl-11">
                      <div className="flex-1">
                        <SearchableSelect
                          options={otherTeams.map((t) => ({ id: t.id, label: t.name }))}
                          value={transferTargetId}
                          onChange={setTransferTargetId}
                          placeholder="Select destination team"
                          searchPlaceholder="Search teams…"
                          emptyText="No other teams"
                        />
                      </div>
                      <Button size="sm" className="h-9 gap-1 shrink-0" disabled={!transferTargetId || isPending} onClick={confirmTransfer}>
                        <ArrowRightLeft className="h-3 w-3" /> Move
                      </Button>
                      <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setTransferringId(null)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Available engineers */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Available Engineers ({available.length})
            </p>
            {available.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No available engineers to add.</p>
            )}
            {available.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
                <UserAvatar name={u.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  {u.team_id && (
                    <p className="text-[10px] text-amber-600 mt-0.5">Currently in another team</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 shrink-0"
                  disabled={isPending}
                  onClick={() => onDirectAdd(u.id)}
                >
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>Done</Button>
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
            {isTH ? 'Transfer Cases' : 'Request Case Transfer'}
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
                Select a destination team
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
