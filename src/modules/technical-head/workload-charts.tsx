'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, Legend,
} from 'recharts'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Maximize2, Users, UserCog } from 'lucide-react'
import { cn, PRIORITY_COLORS } from '@/lib/utils'

const PRIORITY_CHART_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f59e0b',
  medium:   '#3b82f6',
  low:      '#94a3b8',
}

const STATUS_OPEN = new Set(['new', 'triaged', 'assigned', 'in_progress', 'pending_client', 'escalated'])

const TOP_TEAM_COUNT = 3
const TOP_ENGINEER_COUNT = 5
const TEAM_BAR_WIDTH = 90    // px per team category — sizes the scrollable "view all" chart
const ENGINEER_ROW_HEIGHT = 36 // px per engineer row — sizes the scrollable "view all" chart

function engineerBarColor(active: number) {
  return active >= 4 ? '#ef4444' : active >= 2 ? '#f59e0b' : '#6366f1'
}

type EngineerRow = { name: string; active: number; team: string }

export function WorkloadCharts() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesPage } = useQuery({
    queryKey: ['cases', 'all-teams'],
    queryFn: () => dp.listCases(scope, { pageSize: 500 }),
  })
  const { data: teams }  = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
  const { data: users }  = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })

  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [engineerModalOpen, setEngineerModalOpen] = useState(false)

  const cases = useMemo(() => (casesPage?.items ?? []).filter((c) => STATUS_OPEN.has(c.status)), [casesPage])

  // ── Team load chart — sorted heaviest → lightest ───────────────────────────
  const teamChartData = useMemo(() => {
    if (!teams) return []
    return teams.map((t) => {
      const tc = cases.filter((c) => c.team_id === t.id)
      return {
        name:     t.name.replace(' Support Team', ''),
        critical: tc.filter((c) => c.priority === 'critical').length,
        high:     tc.filter((c) => c.priority === 'high').length,
        medium:   tc.filter((c) => c.priority === 'medium').length,
        low:      tc.filter((c) => c.priority === 'low').length,
        total:    tc.length,
      }
    }).sort((a, b) => b.total - a.total)
  }, [cases, teams])
  const topTeamChartData = useMemo(() => teamChartData.slice(0, TOP_TEAM_COUNT), [teamChartData])

  // ── Engineer load chart — sorted heaviest → lightest ────────────────────────
  const engineerChartData = useMemo<EngineerRow[]>(() => {
    if (!users) return []
    const engineers = users.filter((u) => u.role === 'support_engineer' && u.is_active)
    return engineers.map((u) => ({
      name:   u.name.split(' ')[0],
      active: cases.filter((c) => c.assignee_id === u.id).length,
      team:   teams?.find((t) => t.id === u.team_id)?.name.replace(' Support Team', '') ?? '—',
    })).sort((a, b) => b.active - a.active)
  }, [cases, users, teams])
  const topEngineerChartData = useMemo(() => engineerChartData.slice(0, TOP_ENGINEER_COUNT), [engineerChartData])

  // ── Status breakdown ───────────────────────────────────────────────────────
  const statusBreakdown = useMemo(() => {
    const statusList = ['new', 'triaged', 'assigned', 'in_progress', 'pending_client', 'escalated'] as const
    return statusList.map((s) => ({
      status: s.replace('_', ' '),
      count:  cases.filter((c) => c.status === s).length,
    })).filter((s) => s.count > 0)
  }, [cases])

  // ── Priority breakdown ─────────────────────────────────────────────────────
  const priorityBreakdown = useMemo(() => {
    return (['critical', 'high', 'medium', 'low'] as const).map((p) => ({
      name:  p,
      count: cases.filter((c) => c.priority === p).length,
    }))
  }, [cases])

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-xs">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-muted-foreground capitalize">{p.name}:</span>
            <span className="font-semibold">{p.value}</span>
          </div>
        ))}
      </div>
    )
  }

  const EngineerTooltip = ({ active, payload, label, data }: { active?: boolean; payload?: Array<{ value: number }>; label?: string; data: EngineerRow[] }) => {
    if (!active || !payload?.length) return null
    const d = data.find((x) => x.name === label)
    return (
      <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-xs">
        <p className="font-semibold">{label} <span className="text-muted-foreground">({d?.team})</span></p>
        <p>{payload[0].value} active case{payload[0].value !== 1 ? 's' : ''}</p>
      </div>
    )
  }

  const engineerLegend = (
    <p className="text-[11px] text-muted-foreground">
      <span className="inline-block w-2 h-2 rounded-sm bg-red-500 mr-1" />4+ cases — overloaded
      <span className="inline-block w-2 h-2 rounded-sm bg-amber-500 ml-3 mr-1" />2–3 cases — busy
      <span className="inline-block w-2 h-2 rounded-sm bg-primary ml-3 mr-1" />0–1 cases — available
    </p>
  )

  return (
    <div className="space-y-6">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {priorityBreakdown.map(({ name, count }) => (
          <div key={name} className={cn('text-xs font-medium px-3 py-1.5 rounded-full', PRIORITY_COLORS[name])}>
            {count} {name}
          </div>
        ))}
        <div className="text-xs font-medium px-3 py-1.5 rounded-full bg-muted text-muted-foreground">
          {cases.length} total open
        </div>
      </div>

      {/* Team load */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">Top {TOP_TEAM_COUNT} Team Case Load (open cases by priority)</h3>
          {teamChartData.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTeamModalOpen(true)}
              className="h-7 px-2.5 text-xs shrink-0"
            >
              <Maximize2 className="h-3.5 w-3.5" /> View All
            </Button>
          )}
        </div>
        {topTeamChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={topTeamChartData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} width={24} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="critical" stackId="a" fill={PRIORITY_CHART_COLORS.critical} radius={0} />
              <Bar dataKey="high"     stackId="a" fill={PRIORITY_CHART_COLORS.high}     radius={0} />
              <Bar dataKey="medium"   stackId="a" fill={PRIORITY_CHART_COLORS.medium}   radius={0} />
              <Bar dataKey="low"      stackId="a" fill={PRIORITY_CHART_COLORS.low}      radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-muted-foreground py-4 text-center">No open cases</p>}
      </div>

      {/* Engineer load */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">Top {TOP_ENGINEER_COUNT} Engineer Active Case Count</h3>
          {engineerChartData.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEngineerModalOpen(true)}
              className="h-7 px-2.5 text-xs shrink-0"
            >
              <Maximize2 className="h-3.5 w-3.5" /> View All
            </Button>
          )}
        </div>
        {topEngineerChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(140, topEngineerChartData.length * ENGINEER_ROW_HEIGHT)}>
            <BarChart layout="vertical" data={topEngineerChartData} margin={{ top: 0, right: 24, bottom: 0, left: 48 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={48} />
              <Tooltip content={<EngineerTooltip data={topEngineerChartData} />} />
              <Bar dataKey="active" radius={[0, 4, 4, 0]}>
                {topEngineerChartData.map((entry, i) => (
                  <Cell key={i} fill={engineerBarColor(entry.active)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-muted-foreground py-4 text-center">No engineers with active cases</p>}
        {engineerLegend}
      </div>

      {/* Status breakdown */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Status Distribution</h3>
        <div className="space-y-2">
          {statusBreakdown.map(({ status, count }) => {
            const pct = cases.length > 0 ? Math.round((count / cases.length) * 100) : 0
            return (
              <div key={status} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-28 capitalize shrink-0">{status}</span>
                <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-semibold text-foreground tabular-nums w-8 text-right">{count}</span>
                <span className="text-xs text-muted-foreground w-8">{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* All-teams modal — sorted heaviest → lightest, horizontally scrollable */}
      <Dialog open={teamModalOpen} onOpenChange={setTeamModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2 pr-6">
              <Users className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> Team Case Load — All Teams
            </DialogTitle>
            <DialogDescription>
              {teamChartData.length} team{teamChartData.length !== 1 ? 's' : ''} · sorted by open case load, heaviest first
            </DialogDescription>
          </DialogHeader>
          {teamChartData.length > 0 ? (
            <div className="rounded-lg border bg-muted/20 p-3 overflow-x-auto">
              <div style={{ width: Math.max(600, teamChartData.length * TEAM_BAR_WIDTH) }}>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={teamChartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                    <YAxis tick={{ fontSize: 11 }} width={24} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="critical" stackId="a" fill={PRIORITY_CHART_COLORS.critical} radius={0} />
                    <Bar dataKey="high"     stackId="a" fill={PRIORITY_CHART_COLORS.high}     radius={0} />
                    <Bar dataKey="medium"   stackId="a" fill={PRIORITY_CHART_COLORS.medium}   radius={0} />
                    <Bar dataKey="low"      stackId="a" fill={PRIORITY_CHART_COLORS.low}      radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No teams to show</p>
          )}
        </DialogContent>
      </Dialog>

      {/* All-engineers modal — sorted heaviest → lightest, vertically scrollable */}
      <Dialog open={engineerModalOpen} onOpenChange={setEngineerModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2 pr-6">
              <UserCog className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> Engineer Active Case Count — All Engineers
            </DialogTitle>
            <DialogDescription>
              {engineerChartData.length} engineer{engineerChartData.length !== 1 ? 's' : ''} · sorted by active case count, heaviest first
            </DialogDescription>
          </DialogHeader>
          {engineerChartData.length > 0 ? (
            <div className="rounded-lg border bg-muted/20 p-3 overflow-y-auto max-h-[55vh]">
              <ResponsiveContainer width="100%" height={Math.max(140, engineerChartData.length * ENGINEER_ROW_HEIGHT)}>
                <BarChart layout="vertical" data={engineerChartData} margin={{ top: 0, right: 24, bottom: 0, left: 48 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={48} />
                  <Tooltip content={<EngineerTooltip data={engineerChartData} />} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
                  <Bar dataKey="active" radius={[0, 4, 4, 0]}>
                    {engineerChartData.map((entry, i) => (
                      <Cell key={i} fill={engineerBarColor(entry.active)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No engineers to show</p>
          )}
          {engineerLegend}
        </DialogContent>
      </Dialog>
    </div>
  )
}
