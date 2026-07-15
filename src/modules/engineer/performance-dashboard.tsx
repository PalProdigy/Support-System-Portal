'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { cn } from '@/lib/utils'
import { Star, TrendingUp, Clock, CheckCircle2, ThumbsUp, Trophy } from 'lucide-react'
import type { EngineerMetrics } from '@/types'

function MetricCard({ label, value, sub, icon: Icon, accent }: {
  label: string
  value: string
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  accent?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className={cn('rounded-lg p-1.5', accent ?? 'bg-primary/10')}>
          <Icon className={cn('h-4 w-4', accent ? 'text-white' : 'text-primary')} />
        </div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-3xl font-bold tabular-nums text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function StarDisplay({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground text-sm">No ratings yet</span>
  const full = Math.floor(score)
  const half = score - full >= 0.5
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn('h-4 w-4', n <= full ? 'fill-amber-400 text-amber-400' : n === full + 1 && half ? 'fill-amber-200 text-amber-400' : 'text-muted-foreground/30')}
        />
      ))}
      <span className="text-sm font-semibold ml-1">{score.toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">/5</span>
    </div>
  )
}

function SLABar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="space-y-1">
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{pct}% of resolved cases within SLA</p>
    </div>
  )
}

export function PerformanceDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const { data: metrics, isLoading } = useQuery<EngineerMetrics>({
    queryKey: ['engineer-metrics', session.userId],
    queryFn: () => dp.getEngineerMetrics(session.userId, scope),
    staleTime: 30_000,
  })

  const kpis = useMemo(() => {
    if (!metrics) return null
    return [
      {
        label: 'Points',
        value: String(metrics.points),
        sub: 'Earned by resolving cases',
        icon: Trophy,
        accent: 'bg-amber-500',
      },
      {
        label: 'Total Resolved',
        value: String(metrics.total_resolved),
        sub: `${metrics.open_cases} currently open`,
        icon: CheckCircle2,
        accent: undefined,
      },
      {
        label: 'Avg Resolution',
        value: metrics.avg_resolution_hours != null ? `${metrics.avg_resolution_hours}h` : '—',
        sub: 'From case creation to resolution',
        icon: Clock,
        accent: undefined,
      },
      {
        label: 'SLA Compliance',
        value: `${metrics.sla_compliance_pct}%`,
        sub: undefined,
        icon: TrendingUp,
        accent: undefined,
      },
      {
        label: 'Satisfaction',
        value: metrics.satisfaction_score != null ? `${metrics.satisfaction_score}/5` : '—',
        sub: `${metrics.total_feedback_count} ratings received`,
        icon: ThumbsUp,
        accent: undefined,
      },
    ]
  }, [metrics])

  if (isLoading) {
    return <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
  }

  if (!metrics) return null

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(kpis ?? []).map((k) => <MetricCard key={k.label} {...k} />)}
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* SLA */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">SLA Performance</p>
          <SLABar pct={metrics.sla_compliance_pct} />
          <div className="flex gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />≥90% Excellent</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-500" />≥70% Good</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" />&lt;70% Needs work</span>
          </div>
        </div>

        {/* Satisfaction */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Client Satisfaction</p>
          <StarDisplay score={metrics.satisfaction_score} />
          {metrics.total_feedback_count > 0 && (
            <p className="text-xs text-muted-foreground">Based on {metrics.total_feedback_count} feedback submission{metrics.total_feedback_count !== 1 ? 's' : ''}</p>
          )}
          {metrics.total_feedback_count === 0 && (
            <p className="text-xs text-muted-foreground italic">No client feedback yet. Satisfaction score will appear after your first resolved case receives a rating.</p>
          )}
        </div>
      </div>
    </div>
  )
}