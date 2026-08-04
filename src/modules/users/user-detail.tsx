'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { UserAvatar } from '@/components/shared/user-avatar'
import { StatusBadge } from '@/components/shared/status-badge'
import { PriorityChip } from '@/components/shared/priority-chip'
import { ErrorState } from '@/components/shared/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { ROLE_LABELS } from '@/lib/rbac'
import { cn, formatDateTime, formatDuration } from '@/lib/utils'
import {
  ArrowLeft, Mail, Calendar, Ticket, CheckCircle2,
  AlertTriangle, Clock, Star, TrendingUp, ArrowRightLeft,
  ExternalLink, MessageSquare, Eye, Award, Users, Trophy, BadgeCheck,
  LayoutGrid, FileText, Download, Newspaper, Lightbulb, BookOpen, Briefcase, Medal, Pencil,
} from 'lucide-react'
import type { Case, Feedback, AuditLog, CertificationLevel, SolutionArticle, KBArticle } from '@/types'
import { InfoCard } from '@/modules/profile/shared'
import { EditProfileDialog } from '@/modules/profile/edit-profile-dialog'

const CERT_COLORS: Record<CertificationLevel, string> = {
  L1: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-600',
  L2: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-700',
  L3: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/40 dark:text-violet-400 dark:border-violet-700',
  L4: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700',
  L5: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-700',
}

export function UserDetail({ id }: { id: string }) {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }
  const [showEdit, setShowEdit] = useState(false)

  const { data: users, isLoading: loadingUser } = useQuery({
    queryKey: ['users'],
    queryFn: () => dp.listUsers(),
  })

  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => dp.listTeams(),
  })

  const user = (users ?? []).find((u) => u.id === id) ?? null

  const isEngineer = user ? ['support_engineer', 'team_lead', 'technical_head'].includes(user.role) : false

  // The team this user leads (if they're a team lead) — used to roll up
  // team-wide case activity alongside their own individually-assigned cases.
  const ledTeam = user?.role === 'team_lead' ? (teams ?? []).find((t) => t.lead_user_id === user.id) : undefined

  const { data: clients } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
    enabled: isEngineer,
  })

  const { data: metrics } = useQuery({
    queryKey: ['engineer-metrics', id],
    queryFn: () => dp.getEngineerMetrics(id, scope),
    enabled: isEngineer,
  })

  const { data: casesPage } = useQuery({
    queryKey: ['cases-by-engineer', id],
    queryFn: () => dp.listCases(scope, { assignee_id: id, pageSize: 500 }),
    enabled: isEngineer,
  })

  const { data: teamCasesPage } = useQuery({
    queryKey: ['cases-by-team', ledTeam?.id],
    queryFn: () => dp.listCases(scope, { team_id: ledTeam!.id, pageSize: 500 }),
    enabled: !!ledTeam,
  })

  const { data: allFeedback } = useQuery({
    queryKey: ['feedback'],
    queryFn: () => dp.listFeedback(scope),
    enabled: isEngineer,
  })

  const { data: auditLogs } = useQuery({
    queryKey: ['audit-logs-cases'],
    queryFn: () => dp.listAuditLogs({ entity_type: 'case', limit: 2000 }),
    enabled: isEngineer,
  })

  const { data: solutionArticles } = useQuery({
    queryKey: ['solution-articles'],
    queryFn: () => dp.listSolutionArticles({ status: 'published' }),
    enabled: isEngineer,
  })

  const { data: kbArticlesAll } = useQuery({
    queryKey: ['kb', 'index', session.userId, ''],
    queryFn: () => dp.listKBArticles({}, scope),
    enabled: isEngineer,
  })

  const teamsMap = Object.fromEntries((teams ?? []).map((t) => [t.id, t]))
  const clientsMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c]))
  const cases: Case[] = casesPage?.items ?? []

  const resolvedCases = useMemo(
    () => cases.filter((c) => ['resolved', 'pending_closure', 'closed'].includes(c.status)),
    [cases]
  )
  const openCases = useMemo(
    () => cases.filter((c) => !['resolved', 'pending_closure', 'closed'].includes(c.status)),
    [cases]
  )
  const escalatedCases = useMemo(
    () => cases.filter((c) => c.is_escalated || c.status === 'escalated'),
    [cases]
  )
  const slaBreachedCases = useMemo(
    () => cases.filter((c) => {
      if (!c.sla_due_at) return false
      const due = new Date(c.sla_due_at).getTime()
      return c.resolved_at
        ? new Date(c.resolved_at).getTime() > due
        : Date.now() > due
    }),
    [cases]
  )

  // Cases shifted away from this engineer (was assignee, then replaced)
  const shiftedCaseIds = useMemo(() => {
    const logs: AuditLog[] = auditLogs ?? []
    return new Set(
      logs
        .filter(
          (log) =>
            log.action === 'assign' &&
            log.before?.assignee_id === id &&
            log.after?.assignee_id !== id
        )
        .map((log) => log.entity_id)
    )
  }, [auditLogs, id])

  // Feedback for cases assigned to this engineer
  const caseIds = useMemo(() => new Set(cases.map((c) => c.id)), [cases])
  const myFeedback: Feedback[] = useMemo(
    () => (allFeedback ?? []).filter((f) => caseIds.has(f.case_id)),
    [allFeedback, caseIds]
  )

  const feedbackMap = useMemo(
    () => Object.fromEntries(myFeedback.map((f) => [f.case_id, f])),
    [myFeedback]
  )

  // Cases that have client feedback
  const casesWithFeedback = useMemo(
    () => cases.filter((c) => feedbackMap[c.id]),
    [cases, feedbackMap]
  )

  // Articles authored by this user — solution articles + published KB articles.
  const myArticles: SolutionArticle[] = useMemo(
    () => (solutionArticles ?? []).filter((a) => a.created_by === id),
    [solutionArticles, id]
  )
  const myKbArticles: KBArticle[] = useMemo(
    () => (kbArticlesAll ?? []).filter((a) => a.author_id === id && a.status === 'published'),
    [kbArticlesAll, id]
  )

  // Monthly resolution data for bar chart (last 6 months)
  const monthlyData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const monthIdx = d.getMonth()
      const year = d.getFullYear()
      return {
        name: d.toLocaleString('default', { month: 'short' }),
        Resolved: resolvedCases.filter((c) => {
          if (!c.resolved_at) return false
          const rd = new Date(c.resolved_at)
          return rd.getMonth() === monthIdx && rd.getFullYear() === year
        }).length,
        Escalated: escalatedCases.filter((c) => {
          const rd = new Date(c.created_at)
          return rd.getMonth() === monthIdx && rd.getFullYear() === year
        }).length,
      }
    })
  }, [resolvedCases, escalatedCases])

  // Pie chart data
  const pieData = useMemo(() => [
    { name: 'Resolved', value: resolvedCases.length, color: '#10b981' },
    { name: 'Open', value: Math.max(openCases.length - escalatedCases.length, 0), color: '#3b82f6' },
    { name: 'Escalated', value: escalatedCases.length, color: '#ef4444' },
    { name: 'SLA Breached', value: slaBreachedCases.length, color: '#f59e0b' },
  ].filter((d) => d.value > 0), [resolvedCases, openCases, escalatedCases, slaBreachedCases])

  // ── Team-wide rollup (team lead's own cases + every case owned by their team) ──
  const teamCases: Case[] = teamCasesPage?.items ?? []

  const combinedCases: Case[] = useMemo(() => {
    const map = new Map<string, Case>()
    for (const c of cases) map.set(c.id, c)
    for (const c of teamCases) map.set(c.id, c)
    return Array.from(map.values())
  }, [cases, teamCases])

  const combinedResolvedCases = useMemo(
    () => combinedCases.filter((c) => ['resolved', 'pending_closure', 'closed'].includes(c.status)),
    [combinedCases]
  )
  const combinedOpenCases = useMemo(
    () => combinedCases.filter((c) => !['resolved', 'pending_closure', 'closed'].includes(c.status)),
    [combinedCases]
  )
  const combinedEscalatedCases = useMemo(
    () => combinedCases.filter((c) => c.is_escalated || c.status === 'escalated'),
    [combinedCases]
  )
  const combinedSlaBreachedCases = useMemo(
    () => combinedCases.filter((c) => {
      if (!c.sla_due_at) return false
      const due = new Date(c.sla_due_at).getTime()
      return c.resolved_at
        ? new Date(c.resolved_at).getTime() > due
        : Date.now() > due
    }),
    [combinedCases]
  )

  // Success rate: share of all team-handled cases that were resolved.
  const teamSuccessRatePct = combinedCases.length > 0
    ? (combinedResolvedCases.length / combinedCases.length) * 100
    : null

  const teamMonthlyData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const monthIdx = d.getMonth()
      const year = d.getFullYear()
      return {
        name: d.toLocaleString('default', { month: 'short' }),
        Resolved: combinedResolvedCases.filter((c) => {
          if (!c.resolved_at) return false
          const rd = new Date(c.resolved_at)
          return rd.getMonth() === monthIdx && rd.getFullYear() === year
        }).length,
        Escalated: combinedEscalatedCases.filter((c) => {
          const rd = new Date(c.created_at)
          return rd.getMonth() === monthIdx && rd.getFullYear() === year
        }).length,
      }
    })
  }, [combinedResolvedCases, combinedEscalatedCases])

  const teamPieData = useMemo(() => [
    { name: 'Resolved', value: combinedResolvedCases.length, color: '#10b981' },
    { name: 'Open', value: Math.max(combinedOpenCases.length - combinedEscalatedCases.length, 0), color: '#3b82f6' },
    { name: 'Escalated', value: combinedEscalatedCases.length, color: '#ef4444' },
    { name: 'SLA Breached', value: combinedSlaBreachedCases.length, color: '#f59e0b' },
  ].filter((d) => d.value > 0), [combinedResolvedCases, combinedOpenCases, combinedEscalatedCases, combinedSlaBreachedCases])

  if (loadingUser) return <PageSkeleton onBack={() => router.back()} />
  if (!user) return (
    <div className="p-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <ErrorState message="User not found." />
    </div>
  )

  const teamName = user.team_id ? teamsMap[user.team_id]?.name : undefined

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Profile header */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 flex items-start gap-5 flex-wrap">
        <UserAvatar name={user.name} avatarUrl={user.avatar} size="lg" border shadow />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
            <div className="flex items-center gap-2 shrink-0">
              {session.userId === user.id && (
                <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit Profile
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span>{user.email}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>Joined {formatDateTime(user.created_at)}</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
            {teamName && <Badge variant="outline">{teamName}</Badge>}
            {user.certification_level && (
              <Badge
                variant="outline"
                className={cn('font-mono font-bold gap-1', CERT_COLORS[user.certification_level])}
              >
                <Award className="h-3 w-3" /> {user.certification_level}
              </Badge>
            )}
            {isEngineer && metrics && (
                <Badge
                    variant="outline"
                    className="font-mono gap-1 bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700"
                >
                  <Trophy className="h-3 w-3" /> {metrics.points} pts
                </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Non-engineer: no further stats */}
      {!isEngineer && (
        <div className="rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Performance metrics and case history are only tracked for Support Engineers, Team Leads, and Technical Heads.
        </div>
      )}

      {isEngineer && (
        <Tabs defaultValue="overview">
          <TabsList className="h-auto flex-wrap gap-1 p-1">
            <TabsTrigger value="overview" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="certification" className="gap-1.5"><Award className="h-3.5 w-3.5" /> Certification</TabsTrigger>
            <TabsTrigger value="cases" className="gap-1.5"><Ticket className="h-3.5 w-3.5" /> Cases ({cases.length})</TabsTrigger>
            <TabsTrigger value="articles" className="gap-1.5"><Newspaper className="h-3.5 w-3.5" /> Articles ({myArticles.length + myKbArticles.length})</TabsTrigger>
          </TabsList>

          {/* ── Overview tab ──────────────────────────────────────────────── */}
          <TabsContent value="overview" className="mt-4 space-y-6">
            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard icon={<Ticket className="h-5 w-5" />} color="blue" label="Total Engaged" value={String(cases.length)} />
              <KpiCard icon={<CheckCircle2 className="h-5 w-5" />} color="emerald" label="Total Solved" value={String(resolvedCases.length)} />
              <KpiCard icon={<AlertTriangle className="h-5 w-5" />} color="red" label="Escalated" value={String(escalatedCases.length)} />
              <KpiCard icon={<ArrowRightLeft className="h-5 w-5" />} color="violet" label="Shifted Away" value={String(shiftedCaseIds.size)} />
              <KpiCard icon={<Ticket className="h-5 w-5" />} color="slate" label="Open Now" value={String(openCases.length)} />
              <KpiCard
                icon={<Star className="h-5 w-5" />}
                color="yellow"
                label="Satisfaction"
                value={metrics?.satisfaction_score != null
                  ? `${metrics.satisfaction_score.toFixed(1)} / 5`
                  : '—'}
                sub={metrics?.total_feedback_count ? `${metrics.total_feedback_count} reviews` : undefined}
              />
              <KpiCard
                icon={<BadgeCheck className="h-5 w-5" />}
                color="primary"
                label="Certification"
                value={user.certification_level ?? '—'}
                sub={user.certifications?.length ? `${user.certifications.length} certificate${user.certifications.length !== 1 ? 's' : ''}` : undefined}
              />
            </div>

            {/* Charts */}
            {cases.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie: case distribution */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-1.5"><Ticket className="h-4 w-4 text-muted-foreground" /> Case Distribution</p>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No case data</p>
                  )}
                </div>

                {/* Bar: monthly resolutions */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-muted-foreground" /> Monthly Activity (last 6 months)</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthlyData} barSize={14} barGap={4}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Resolved" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Escalated" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Team-wide rollup — team lead's own cases + every case owned by their team */}
            {user.role === 'team_lead' && ledTeam && (
              <div className="space-y-4 pt-2">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Team Performance — {ledTeam.name}
                </h2>

                {/* Success rate (line bar) across every case he and his team handled */}
                {teamSuccessRatePct != null && (
                  <div className="rounded-xl border bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-indigo-500" />
                        <span className="text-sm font-semibold">Team Success Rate</span>
                      </div>
                      <span className={`text-sm font-bold ${
                        teamSuccessRatePct >= 90 ? 'text-emerald-600'
                        : teamSuccessRatePct >= 70 ? 'text-amber-600'
                        : 'text-red-600'}`}>
                        {teamSuccessRatePct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          teamSuccessRatePct >= 90 ? 'bg-emerald-500'
                          : teamSuccessRatePct >= 70 ? 'bg-amber-500'
                          : 'bg-red-500'}`}
                        style={{ width: `${Math.min(teamSuccessRatePct, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {combinedResolvedCases.length} resolved out of {combinedCases.length} case{combinedCases.length !== 1 ? 's' : ''} handled by him and his team
                    </p>
                  </div>
                )}

                {combinedCases.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Pie: team case distribution */}
                    <div className="rounded-xl border bg-card p-4 space-y-3">
                      <p className="text-sm font-semibold flex items-center gap-1.5"><Ticket className="h-4 w-4 text-muted-foreground" /> Case Distribution</p>
                      {teamPieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              data={teamPieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={85}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {teamPieData.map((entry, index) => (
                                <Cell key={index} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ fontSize: 12 }} />
                            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">No case data</p>
                      )}
                    </div>

                    {/* Bar: monthly team activity */}
                    <div className="rounded-xl border bg-card p-4 space-y-3">
                      <p className="text-sm font-semibold flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-muted-foreground" /> Monthly Case Activity (last 6 months)</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={teamMonthlyData} barSize={14} barGap={4}>
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                          <Tooltip contentStyle={{ fontSize: 12 }} />
                          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="Resolved" fill="#10b981" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="Escalated" fill="#ef4444" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Client feedback */}
            <div className="space-y-3 pt-2">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Client Feedback <span className="text-sm font-normal text-muted-foreground">({casesWithFeedback.length})</span>
              </h2>
              {casesWithFeedback.length === 0 ? (
                <div className="rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  No client feedback received yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {casesWithFeedback.map((c) => {
                    const fb = feedbackMap[c.id]!
                    const clientName = clientsMap[c.client_id]?.company_name
                    return (
                      <div key={c.id} className="rounded-xl border bg-card p-4 space-y-3 transition-all hover:border-primary/40 hover:shadow-md">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono text-muted-foreground">{c.reference_no}</span>
                            <PriorityChip priority={c.priority} />
                            <StatusBadge status={c.status} />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 gap-1 text-xs"
                            onClick={() => router.push(`/cases/${c.id}`)}
                          >
                            <ExternalLink className="h-3 w-3" /> View
                          </Button>
                        </div>
                        <p className="text-sm font-medium text-foreground">{c.title}</p>

                        <div className="rounded-lg bg-muted/40 p-3 space-y-2">
                          {fb.rating != null && (
                            <div className="flex items-center gap-1.5">
                              <div className="flex">
                                {Array.from({ length: 5 }, (_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-4 w-4 ${i < fb.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs font-semibold text-foreground">{fb.rating} / 5</span>
                              <span className="text-[10px] text-muted-foreground ml-1">
                                {fb.rating >= 4 ? 'Excellent' : fb.rating === 3 ? 'Satisfactory' : 'Needs improvement'}
                              </span>
                            </div>
                          )}
                          {fb.feedback_text && (
                            <p className="text-sm text-muted-foreground italic leading-relaxed">
                              &ldquo;{fb.feedback_text}&rdquo;
                            </p>
                          )}
                          <div className="flex items-center justify-between flex-wrap gap-1 pt-0.5">
                            {clientName && (
                              <p className="text-xs font-medium text-foreground">{clientName}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground">{formatDateTime(fb.created_at)}</p>
                          </div>
                        </div>

                        {c.resolved_at && (
                          <p className="text-xs text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Resolved in {formatDuration(
                              new Date(c.resolved_at).getTime() - new Date(c.created_at).getTime()
                            )}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Certification tab ─────────────────────────────────────────── */}
          <TabsContent value="certification" className="mt-4 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <KpiCard
                icon={<Award className="h-5 w-5" />}
                color="primary"
                label="Certification Level"
                value={user.certification_level ?? '—'}
              />
              <KpiCard
                icon={<Briefcase className="h-5 w-5" />}
                color="sky"
                label="Experience"
                value={user.years_of_experience != null ? `${user.years_of_experience} yr` : '—'}
              />
              <KpiCard
                icon={<FileText className="h-5 w-5" />}
                color="violet"
                label="Documents"
                value={String(user.certifications?.length ?? 0)}
              />
            </div>

            <InfoCard title="Certifications" icon={<Award className="h-3.5 w-3.5" />}>
              {user.certifications && user.certifications.length > 0 ? (
                <div className="space-y-2.5">
                  {user.certifications.map((c) => (
                    <div key={c.id} className="rounded-lg border p-3 flex items-start gap-3 transition-all hover:border-primary/40 hover:shadow-sm">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
                        <Award className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{c.title}</p>
                        {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                        {c.file_name && (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <FileText className="h-3.5 w-3.5" /> {c.file_name}
                          </div>
                        )}
                      </div>
                      {c.file_url && (
                        <a href={c.file_url} download={c.file_name} className="text-muted-foreground hover:text-primary p-1 shrink-0" title="Download">
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No certifications added yet.</p>}
            </InfoCard>

            <InfoCard title="Achievements" icon={<Trophy className="h-3.5 w-3.5" />}>
              {user.achievements && user.achievements.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {user.achievements.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
                      <Medal className="h-5 w-5 shrink-0 text-violet-500" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground leading-tight">{a.title}</p>
                        {a.description && <p className="text-[11px] text-muted-foreground mt-0.5">{a.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No achievements recorded yet.</p>}
            </InfoCard>
          </TabsContent>

          {/* ── Cases tab ─────────────────────────────────────────────────── */}
          <TabsContent value="cases" className="mt-4">
            {cases.length === 0 ? (
              <div className="rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                No cases have been assigned to this engineer yet.
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Ref</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Title</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Priority</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">Client Feedback</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">Resolution</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cases.map((c) => {
                      const resTime = c.resolved_at
                        ? new Date(c.resolved_at).getTime() - new Date(c.created_at).getTime()
                        : null
                      const isSLABreached = c.sla_due_at &&
                        (c.resolved_at
                          ? new Date(c.resolved_at).getTime() > new Date(c.sla_due_at).getTime()
                          : Date.now() > new Date(c.sla_due_at).getTime())
                      const fb = feedbackMap[c.id]
                      return (
                        <tr
                          key={c.id}
                          className="hover:bg-muted/30 transition-colors cursor-pointer align-top"
                          onClick={() => router.push(`/users/${id}/cases/${c.id}`)}
                        >
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-mono text-muted-foreground">{c.reference_no}</span>
                          </td>
                          <td className="px-4 py-3 max-w-[200px]">
                            <p className="truncate text-sm font-medium text-foreground">{c.title}</p>
                            {isSLABreached && (
                              <span className="text-[10px] text-amber-600 font-medium">SLA Breached</span>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <PriorityChip priority={c.priority} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={c.status} />
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell max-w-[220px]">
                            {fb ? (
                              <div className="space-y-1">
                                {fb.rating != null && (
                                  <div className="flex items-center gap-1">
                                    {[0,1,2,3,4].map((i) => (
                                      <Star
                                        key={i}
                                        className={`h-3 w-3 ${i < fb.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/25'}`}
                                      />
                                    ))}
                                    <span className="text-[10px] font-semibold text-foreground ml-0.5">{fb.rating}/5</span>
                                  </div>
                                )}
                                {fb.feedback_text ? (
                                  <p className="text-[11px] text-muted-foreground italic leading-snug line-clamp-2">
                                    &ldquo;{fb.feedback_text}&rdquo;
                                  </p>
                                ) : (
                                  <p className="text-[11px] text-muted-foreground/50 italic">No comment</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/40 italic">No feedback</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden lg:table-cell">
                            {resTime != null
                              ? <span className="text-emerald-600">{formatDuration(resTime)}</span>
                              : <span className="text-muted-foreground/50">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ── Articles tab ──────────────────────────────────────────────── */}
          <TabsContent value="articles" className="mt-4">
            <Tabs defaultValue="solution-articles">
              <TabsList className="h-auto flex-wrap gap-1 p-1">
                <TabsTrigger value="solution-articles" className="gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5" /> Solution Articles ({myArticles.length})
                </TabsTrigger>
                <TabsTrigger value="kb-articles" className="gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> Knowledge Base Articles ({myKbArticles.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="solution-articles" className="mt-4">
                {myArticles.length === 0 ? (
                  <div className="rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                    No solution articles written yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {myArticles.map((a) => (
                      <div key={a.id} className="rounded-lg border p-3 flex items-start justify-between gap-3 transition-all hover:border-primary/40 hover:shadow-sm">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Lightbulb className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                            {a.category && <p className="text-xs text-muted-foreground mt-0.5">{a.category}</p>}
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="shrink-0" onClick={() => router.push(`/solutions/articles/${a.slug}`)}>
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="kb-articles" className="mt-4">
                {myKbArticles.length === 0 ? (
                  <div className="rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                    No knowledge base articles published yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {myKbArticles.map((a) => (
                      <div key={a.id} className="rounded-lg border p-3 flex items-start justify-between gap-3 transition-all hover:border-primary/40 hover:shadow-sm">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
                            <BookOpen className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                            {a.category && <p className="text-xs text-muted-foreground mt-0.5">{a.category}</p>}
                            {a.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="shrink-0" onClick={() => router.push(`/knowledge-base/${a.slug}`)}>
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      )}

      {/* Edit profile — mounted only while open, own profile only */}
      {showEdit && session.userId === user.id && (
        <EditProfileDialog user={user} open onOpenChange={setShowEdit} />
      )}
    </div>
  )
}

const KPI_COLORS = {
  blue: 'bg-blue-500/10 text-blue-500',
  emerald: 'bg-emerald-500/10 text-emerald-500',
  red: 'bg-red-500/10 text-red-500',
  violet: 'bg-violet-500/10 text-violet-500',
  slate: 'bg-slate-500/10 text-slate-400',
  yellow: 'bg-yellow-500/10 text-yellow-500',
  amber: 'bg-amber-500/10 text-amber-500',
  sky: 'bg-sky-500/10 text-sky-500',
  primary: 'bg-primary/10 text-primary',
} as const

function KpiCard({ icon, label, value, sub, color = 'slate' }: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color?: keyof typeof KPI_COLORS
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-3 transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5">
      <div className={cn('shrink-0 rounded-lg p-2.5', KPI_COLORS[color])}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-xl font-bold text-foreground leading-tight truncate">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  )
}

function PageSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
      <Skeleton className="h-32 rounded-xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}
