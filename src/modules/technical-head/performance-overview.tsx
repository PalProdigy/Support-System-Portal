'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { cn } from '@/lib/utils'
import { Star, TrendingUp } from 'lucide-react'
import type { EngineerMetrics, User } from '@/types'

function StarRow({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('h-3 w-3', n <= Math.round(score) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
      ))}
      <span className="text-xs ml-0.5 text-muted-foreground">{score.toFixed(1)}</span>
    </div>
  )
}

function SLABadge({ pct }: { pct: number }) {
  const cls = pct >= 90 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
    pct >= 70 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  return <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-full', cls)}>{pct}%</span>
}

export function PerformanceOverview() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const { data: metrics, isLoading: metricsLoading } = useQuery<EngineerMetrics[]>({
    queryKey: ['all-engineer-metrics'],
    queryFn: () => dp.listAllEngineerMetrics(scope),
    staleTime: 30_000,
  })

  const { data: users } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => dp.listUsers(),
  })

  const usersMap = useMemo(
    () => Object.fromEntries((users ?? []).map((u) => [u.id, u])),
    [users]
  )

  const totals = useMemo(() => {
    if (!metrics?.length) return null
    const total_resolved = metrics.reduce((s, m) => s + m.total_resolved, 0)
    const scored = metrics.filter((m) => m.satisfaction_score != null)
    const avg_satisfaction = scored.length ? scored.reduce((s, m) => s + (m.satisfaction_score ?? 0), 0) / scored.length : null
    const avg_sla = Math.round(metrics.reduce((s, m) => s + m.sla_compliance_pct, 0) / metrics.length)
    return { total_resolved, avg_satisfaction, avg_sla }
  }, [metrics])

  if (metricsLoading) {
    return <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}</div>
  }

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      {totals && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Resolved (All)', value: totals.total_resolved },
            { label: 'Avg SLA Compliance', value: `${totals.avg_sla}%` },
            { label: 'Avg Satisfaction', value: totals.avg_satisfaction != null ? `${totals.avg_satisfaction.toFixed(1)}/5` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border bg-card p-3 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Engineer table */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Engineer Performance Rankings</h3>
          <span className="text-xs text-muted-foreground ml-auto">{(metrics ?? []).length} engineers</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30">
              {['#', 'Engineer', 'Resolved', 'Avg Time', 'SLA %', 'Satisfaction', 'Open'].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(metrics ?? []).length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-sm text-muted-foreground">No engineer data yet</td></tr>
            )}
            {(metrics ?? []).map((m, i) => {
              const user = usersMap[m.engineer_id]
              return (
                <tr key={m.engineer_id} className="border-t hover:bg-accent/20 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-foreground">{user?.name ?? m.engineer_id}</p>
                      <p className="text-[11px] text-muted-foreground">{user?.email ?? ''}</p>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-sm font-semibold tabular-nums text-foreground">{m.total_resolved}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {m.avg_resolution_hours != null ? `${m.avg_resolution_hours}h` : '—'}
                  </td>
                  <td className="px-3 py-2.5"><SLABadge pct={m.sla_compliance_pct} /></td>
                  <td className="px-3 py-2.5"><StarRow score={m.satisfaction_score} /></td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-muted-foreground">{m.open_cases}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}