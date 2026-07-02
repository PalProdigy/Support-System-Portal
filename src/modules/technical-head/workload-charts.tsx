'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, Legend,
} from 'recharts'
import { cn, PRIORITY_COLORS } from '@/lib/utils'

const PRIORITY_CHART_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f59e0b',
  medium:   '#3b82f6',
  low:      '#94a3b8',
}

const STATUS_OPEN = new Set(['new', 'triaged', 'assigned', 'in_progress', 'pending_client', 'escalated'])

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

  const cases = useMemo(() => (casesPage?.items ?? []).filter((c) => STATUS_OPEN.has(c.status)), [casesPage])

  // ── Team load chart ────────────────────────────────────────────────────────
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
    })
  }, [cases, teams])

  // ── Engineer load chart ────────────────────────────────────────────────────
  const engineerChartData = useMemo(() => {
    if (!users) return []
    const engineers = users.filter((u) => u.role === 'support_engineer' && u.is_active)
    return engineers.map((u) => ({
      name:   u.name.split(' ')[0],
      active: cases.filter((c) => c.assignee_id === u.id).length,
      team:   teams?.find((t) => t.id === u.team_id)?.name.replace(' Support Team', '') ?? '—',
    })).sort((a, b) => b.active - a.active)
  }, [cases, users, teams])

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
        <h3 className="text-sm font-semibold text-foreground">Team Case Load (open cases by priority)</h3>
        {teamChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={teamChartData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
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
        <h3 className="text-sm font-semibold text-foreground">Engineer Active Case Count</h3>
        {engineerChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(140, engineerChartData.length * 36)}>
            <BarChart layout="vertical" data={engineerChartData} margin={{ top: 0, right: 24, bottom: 0, left: 48 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={48} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const d = engineerChartData.find((x) => x.name === label)
                  return (
                    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-xs">
                      <p className="font-semibold">{label} <span className="text-muted-foreground">({d?.team})</span></p>
                      <p>{payload[0].value} active case{payload[0].value !== 1 ? 's' : ''}</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="active" radius={[0, 4, 4, 0]}>
                {engineerChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.active >= 4 ? '#ef4444' : entry.active >= 2 ? '#f59e0b' : '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-muted-foreground py-4 text-center">No engineers with active cases</p>}
        <p className="text-[11px] text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-sm bg-red-500 mr-1" />4+ cases — overloaded
          <span className="inline-block w-2 h-2 rounded-sm bg-amber-500 ml-3 mr-1" />2–3 cases — busy
          <span className="inline-block w-2 h-2 rounded-sm bg-primary ml-3 mr-1" />0–1 cases — available
        </p>
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
    </div>
  )
}
