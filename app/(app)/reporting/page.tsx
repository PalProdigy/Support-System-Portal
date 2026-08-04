'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/shared/user-avatar'
import type { Case, EngineerMetrics, User, Team, Client, Solution } from '@/types'
import { cn, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS } from '@/lib/utils'
import { SearchableSelect } from '@/components/shared/searchable-select'
import {
  BarChart3, LayoutGrid, Users, Trophy, Activity, Award, Lightbulb,
  BadgeCheck, Star, CheckCircle2, Clock, AlertTriangle, Ticket, Crown,
} from 'lucide-react'

const BarChart = dynamic(
  () => import('recharts').then((m) => m.BarChart),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full rounded-xl" /> }
)
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false })
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full rounded-xl" /> }
)

// Reference caseload used to scale the workload bar so it reads consistently
// regardless of team size, rather than always stretching relative to whoever has the most.
const WORKLOAD_CAPACITY = 8
const WORKHOUR_WINDOW_WEEKS = 4
const ALL_TEAMS = 'all'

const ENGINEER_RANGES = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '7d', label: '7 Days', days: 7 },
  { key: '15d', label: '15 Days', days: 15 },
  { key: '30d', label: '30 Days', days: 30 },
  { key: '90d', label: '90 Days', days: 90 },
] as const
type EngineerRangeKey = typeof ENGINEER_RANGES[number]['key']

function rangeCutoff(days: number, nowMs: number) {
  if (days === 0) {
    const d = new Date(nowMs)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  return nowMs - days * 86_400_000
}

export default function ReportingPage() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const scope = { userId: session.userId, role: session.role }
  const isTH = session.role === 'technical_head'
  const isLead = session.role === 'team_lead'
  const showTeamTabs = session.role !== 'sales_executive'
  // Team Performance is a cross-team comparison — meaningless for a team_lead who
  // only ever has one team, so it's technical_head only. team_lead still gets
  // Engineer Performance / Workload, just pre-scoped to their own team.
  const showTeamCompareTab = isTH

  const REPORT_TABS = showTeamTabs
    ? ['overview', ...(showTeamCompareTab ? ['team'] : []), 'engineer', 'workload']
    : ['overview']
  const [activeTab, setActiveTabState] = useState<string>(() => {
    const t = searchParams.get('tab')
    return t && REPORT_TABS.includes(t) ? t : 'overview'
  })
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const { data: casesData } = useQuery({
    queryKey: ['cases', 'reporting', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 200 }),
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => dp.listUsers(),
    enabled: showTeamTabs,
  })

  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => dp.listTeams(),
    enabled: showTeamTabs,
  })

  const { data: allMetrics } = useQuery({
    queryKey: ['engineer-metrics-all'],
    queryFn: () => dp.listAllEngineerMetrics(scope),
    enabled: showTeamTabs,
  })

  const { data: clients } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
  })

  const { data: solutions } = useQuery({
    queryKey: ['solutions'],
    queryFn: () => dp.listSolutions(),
  })

  const [workloadTab, setWorkloadTab] = useState<'most' | 'least'>('most')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [reportEngineerId, setReportEngineerId] = useState('')
  const [reportRange, setReportRange] = useState<EngineerRangeKey>('7d')
  const [nowMs] = useState(() => Date.now())

  const cases = casesData?.items ?? []
  const escalated = cases.filter((c: Case) => c.is_escalated)
  const openCases = cases.filter((c: Case) => !['resolved', 'pending_closure', 'closed'].includes(c.status))
  const resolvedCases = cases.filter((c: Case) => ['resolved', 'pending_closure', 'closed'].includes(c.status))

  const byStatus = Object.entries(STATUS_LABELS).map(([key, label]) => ({
    name: label,
    count: cases.filter((c: Case) => c.status === key).length,
  })).filter((d) => d.count > 0)

  const byPriority = Object.entries(PRIORITY_LABELS).map(([key, label]) => ({
    name: label,
    count: cases.filter((c: Case) => c.priority === key).length,
  })).filter((d) => d.count > 0)

  const allUsers: User[] = users ?? []
  const myUser = allUsers.find((u) => u.id === session.userId)
  const activeTeams = (teams ?? []).filter((t: Team) => t.is_active !== false)
  // technical_head can inspect any team; team_lead is limited to their own.
  const selectableTeams = isTH
    ? activeTeams
    : activeTeams.filter((t) => t.id === myUser?.team_id || t.lead_user_id === session.userId)
  const effectiveTeamId = selectedTeamId || (isTH ? ALL_TEAMS : selectableTeams[0]?.id ?? '')

  const teamEngineers = allUsers.filter((u) =>
    u.role === 'support_engineer' && (effectiveTeamId === ALL_TEAMS || u.team_id === effectiveTeamId)
  )
  const scopedCases = effectiveTeamId === ALL_TEAMS ? cases : cases.filter((c) => c.team_id === effectiveTeamId)

  const clientsMap = Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c]))
  const solutionsMap = Object.fromEntries((solutions ?? []).map((s: Solution) => [s.id, s]))
  // technical_head sees the whole organization's engineers; team_lead is scoped to their own team.
  const reportEngineers = allUsers.filter((u) =>
    ['support_engineer', 'team_lead'].includes(u.role) && u.is_active && (isTH || u.team_id === myUser?.team_id)
  )
  const reportRangeDef = ENGINEER_RANGES.find((r) => r.key === reportRange)!
  const reportCutoff = rangeCutoff(reportRangeDef.days, nowMs)
  const reportCases = cases
    .filter((c: Case) => new Date(c.created_at).getTime() >= reportCutoff)
    .filter((c: Case) => !reportEngineerId || c.assignee_id === reportEngineerId)
    .sort((a: Case, b: Case) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const metricsMap: Record<string, EngineerMetrics> = Object.fromEntries(
    (allMetrics ?? []).map((m: EngineerMetrics) => [m.engineer_id, m])
  )
  const usersMap = Object.fromEntries(allUsers.map((u) => [u.id, u]))

  const workhourCutoff = nowMs - WORKHOUR_WINDOW_WEEKS * 7 * 86_400_000
  const engineerWorkload = teamEngineers.map((m) => {
    const assigned = scopedCases.filter((c) => c.assignee_id === m.id)
    // Avg weekly workhour is a proxy from case-handling time (created → resolved), not
    // real attendance/clock data — this app has no time-tracking source for that.
    const recentlyResolved = assigned.filter((c) => c.resolved_at && new Date(c.resolved_at).getTime() >= workhourCutoff)
    const avgWeeklyHours = recentlyResolved.length > 0
      ? recentlyResolved.reduce((sum, c) => sum + (new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime()), 0)
        / 3_600_000 / WORKHOUR_WINDOW_WEEKS
      : null
    return {
      id: m.id,
      name: m.name,
      avatar: m.avatar,
      active: assigned.filter((c) => !['resolved', 'pending_closure', 'closed'].includes(c.status)).length,
      total: assigned.length,
      avgWeeklyHours,
    }
  })
  const workloadRows = [...engineerWorkload].sort((a, b) => workloadTab === 'most' ? b.active - a.active : a.active - b.active)

  const rankedEngineers = teamEngineers
    .map((m) => metricsMap[m.id])
    .filter((m): m is EngineerMetrics => m != null)
    .map((m) => ({
      ...m,
      solutionsProvided: new Set(
        scopedCases.filter((c) => c.assignee_id === m.engineer_id).map((c) => c.solution_id)
      ).size,
    }))
    .sort((a, b) => b.points - a.points)

  const teamStats = selectableTeams.map((t) => {
    const tCases = cases.filter((c) => c.team_id === t.id)
    const engineers = allUsers.filter((u) => u.team_id === t.id && u.role === 'support_engineer')
    const lead = allUsers.find((u) => u.id === t.lead_user_id)
    const resolved = tCases.filter((c) => ['resolved', 'pending_closure', 'closed'].includes(c.status))
    const open = tCases.filter((c) => !['resolved', 'pending_closure', 'closed'].includes(c.status))
    const teamEscalated = tCases.filter((c) => c.is_escalated || c.status === 'escalated')
    const sats = engineers.map((e) => metricsMap[e.id]?.satisfaction_score).filter((s): s is number => s != null)
    const avgSat = sats.length > 0 ? sats.reduce((a, b) => a + b, 0) / sats.length : null
    return {
      team: t, lead, engineerCount: engineers.length,
      total: tCases.length, open: open.length, resolved: resolved.length, escalated: teamEscalated.length,
      avgSat,
    }
  }).sort((a, b) => b.total - a.total)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Hero header */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 flex items-center gap-4">
        <div className="rounded-xl bg-primary/15 p-3 shrink-0">
          <BarChart3 className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reporting</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isTH
              ? 'Organization-wide case metrics, team and engineer performance'
              : isLead
              ? `Case metrics and engineer performance for ${selectableTeams[0]?.name ?? 'your team'}`
              : 'Case metrics for your clients'}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="overview" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          {showTeamTabs && (
            <>
              {showTeamCompareTab && (
                <TabsTrigger value="team" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Team Performance</TabsTrigger>
              )}
              <TabsTrigger value="engineer" className="gap-1.5"><Trophy className="h-3.5 w-3.5" /> Engineer Performance</TabsTrigger>
              <TabsTrigger value="workload" className="gap-1.5"><Activity className="h-3.5 w-3.5" /> Workload</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard icon={<Ticket className="h-5 w-5 text-blue-500" />} label="Total Cases" value={String(cases.length)} />
            <KpiCard icon={<AlertTriangle className="h-5 w-5 text-amber-500" />} label="Open Cases" value={String(openCases.length)} />
            <KpiCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} label="Resolved" value={String(resolvedCases.length)} />
            <KpiCard icon={<AlertTriangle className="h-5 w-5 text-red-500" />} label="Escalated" value={String(escalated.length)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold mb-4">Cases by Status</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byStatus} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(221.2, 83.2%, 53.3%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold mb-4">Cases by Priority</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byPriority} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(221.2, 83.2%, 53.3%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {showTeamTabs && (
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-sm font-semibold">Cases</h3>
                <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 shrink-0">
                  {ENGINEER_RANGES.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setReportRange(r.key)}
                      className={cn(
                        'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                        reportRange === r.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-64">
                <SearchableSelect
                  icon={Users}
                  options={reportEngineers.map((e) => ({ id: e.id, label: e.name, sublabel: e.role === 'team_lead' ? 'Team Lead' : 'Engineer' }))}
                  value={reportEngineerId}
                  onChange={setReportEngineerId}
                  placeholder="All Engineers"
                  searchPlaceholder="Search engineers..."
                />
              </div>
              {reportCases.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No cases in this range.</p>
              ) : (
                <div className="divide-y">
                  {reportCases.map((c: Case) => {
                    const client = clientsMap[c.client_id]
                    const solution = solutionsMap[c.solution_id]
                    return (
                      <div key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                        <span className="font-mono text-xs text-muted-foreground shrink-0">{c.reference_no}</span>
                        <span className="flex-1 min-w-0 truncate text-foreground">{c.title}</span>
                        <span className="w-36 shrink-0 truncate text-xs text-muted-foreground">{client?.company_name ?? '—'}</span>
                        <span className="w-36 shrink-0 truncate text-xs text-muted-foreground">{solution?.name ?? '—'}</span>
                        <Badge className={cn('shrink-0 text-[10px]', STATUS_COLORS[c.status])}>{STATUS_LABELS[c.status]}</Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Escalated Cases ({escalated.length})</h3>
            {escalated.length === 0 ? (
              <p className="text-sm text-muted-foreground">No escalated cases.</p>
            ) : (
              <div className="divide-y">
                {escalated.map((c: Case) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{c.reference_no}</span>
                    <span className="flex-1 mx-3 truncate">{c.title}</span>
                    <span className="text-xs text-red-600 font-medium">L{c.escalation_level}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {showTeamTabs && (
          <>
            {/* Team Performance — technical_head only (cross-team comparison) */}
            {showTeamCompareTab && (
            <TabsContent value="team" className="space-y-4 mt-0">
              {teamStats.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No teams to report on yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teamStats.map((s) => {
                    const resolvedPct = s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0
                    return (
                      <div key={s.team.id} className="rounded-xl border bg-card p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{s.team.name}</p>
                            {s.lead && (
                              <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <Crown className="h-3 w-3 text-amber-500" /> {s.lead.name}
                              </p>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                            {s.engineerCount} engineer{s.engineerCount !== 1 ? 's' : ''}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${resolvedPct}%` }} />
                          </div>
                          <span className="text-[11px] font-medium text-muted-foreground tabular-nums shrink-0">{resolvedPct}% resolved</span>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground pt-2 border-t">
                          <span className="flex items-center gap-1"><Ticket className="h-3 w-3" /> {s.total} total</span>
                          <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3 w-3" /> {s.open} open</span>
                          <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> {s.resolved} resolved</span>
                          <span className="flex items-center gap-1 text-red-600"><AlertTriangle className="h-3 w-3" /> {s.escalated} escalated</span>
                          <span className="flex items-center gap-1 text-yellow-600 ml-auto">
                            <Star className="h-3 w-3" /> {s.avgSat != null ? `${s.avgSat.toFixed(1)} / 5` : '—'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>
            )}

            {/* Engineer Performance */}
            <TabsContent value="engineer" className="space-y-4 mt-0">
              <TeamFilter
                isTH={isTH}
                selectableTeams={selectableTeams}
                effectiveTeamId={effectiveTeamId}
                onChange={setSelectedTeamId}
              />
              <div className="rounded-xl border bg-card">
                {rankedEngineers.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No engineer metrics yet</p>
                ) : (
                  <div className="divide-y">
                    {rankedEngineers.map((m, i) => {
                      const u = usersMap[m.engineer_id]
                      const certCount = u?.certifications?.length ?? 0
                      return (
                        <div key={m.engineer_id} className="flex items-start gap-3 px-4 py-3">
                          <span className={cn(
                            'shrink-0 mt-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                            i === 0 ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'
                          )}>
                            {i + 1}
                          </span>
                          {u && <UserAvatar name={u.name} avatarUrl={u.avatar} userId={u.id} size="sm" />}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground truncate">{u?.name ?? m.engineer_id}</p>
                              <span className="flex items-center gap-1 text-xs font-bold tabular-nums text-violet-600 shrink-0">
                                <Award className="h-3.5 w-3.5" /> {m.points} pts
                              </span>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="h-3 w-3" /> {m.total_resolved} resolved
                              </span>
                              <span className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <Star key={n} className={cn('h-3 w-3', m.satisfaction_score != null && n <= Math.round(m.satisfaction_score) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
                                ))}
                                {m.satisfaction_score != null && <span className="ml-0.5">{m.satisfaction_score.toFixed(1)}</span>}
                              </span>
                              <span className="flex items-center gap-1 text-blue-600">
                                <Lightbulb className="h-3 w-3" /> {m.solutionsProvided} solution{m.solutionsProvided !== 1 ? 's' : ''}
                              </span>
                              {u?.certification_level && (
                                <span className="flex items-center gap-1 font-medium text-primary">
                                  <BadgeCheck className="h-3 w-3" /> {u.certification_level}
                                  {certCount > 0 && <span className="text-muted-foreground font-normal">({certCount} cert{certCount !== 1 ? 's' : ''})</span>}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Workload */}
            <TabsContent value="workload" className="space-y-4 mt-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <TeamFilter
                  isTH={isTH}
                  selectableTeams={selectableTeams}
                  effectiveTeamId={effectiveTeamId}
                  onChange={setSelectedTeamId}
                />
                <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 shrink-0">
                  {([
                    { key: 'most', label: 'Most Workload' },
                    { key: 'least', label: 'Least Workload' },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setWorkloadTab(key)}
                      className={cn(
                        'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                        workloadTab === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border bg-card">
                {workloadRows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No engineers to show.</p>
                ) : (
                  <div className="p-4 space-y-3.5">
                    {workloadRows.map((e) => {
                      const level = e.active >= 4 ? 'Heavy' : e.active >= 2 ? 'Medium' : 'Light'
                      const color = e.active >= 4 ? 'red' : e.active >= 2 ? 'amber' : 'emerald'
                      return (
                        <div key={e.id} className="flex items-center gap-3">
                          <UserAvatar name={e.name} avatarUrl={e.avatar} userId={e.id} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-foreground truncate" title={e.name}>{e.name}</span>
                              <span className={cn(
                                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                                color === 'red' ? 'bg-red-500/15 text-red-600' : color === 'amber' ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/15 text-emerald-600'
                              )}>
                                {level}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full transition-all', color === 'red' ? 'bg-red-500' : color === 'amber' ? 'bg-amber-500' : 'bg-emerald-500')}
                                  style={{ width: `${Math.min(100, Math.round((e.active / WORKLOAD_CAPACITY) * 100))}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-medium text-muted-foreground tabular-nums shrink-0">
                                {e.active} open · {e.total} total
                              </span>
                            </div>
                            <p className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/80">
                              <Clock className="h-2.5 w-2.5" />
                              {e.avgWeeklyHours != null
                                ? `~${e.avgWeeklyHours.toFixed(1)}h/week avg (last ${WORKHOUR_WINDOW_WEEKS}w)`
                                : 'No resolutions in last 4 weeks'}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}

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

function TeamFilter({
  isTH, selectableTeams, effectiveTeamId, onChange,
}: {
  isTH: boolean
  selectableTeams: Team[]
  effectiveTeamId: string
  onChange: (id: string) => void
}) {
  if (!isTH) {
    const team = selectableTeams[0]
    return team ? (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" /> {team.name}
      </span>
    ) : null
  }
  return (
    <Select value={effectiveTeamId} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[200px] text-xs">
        <SelectValue placeholder="Select team" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_TEAMS}>All Teams</SelectItem>
        {selectableTeams.map((t) => (
          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
