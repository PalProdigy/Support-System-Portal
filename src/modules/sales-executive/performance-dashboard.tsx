'use client'

import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { cn, formatDate } from '@/lib/utils'
import {
  Target, Wallet, TrendingUp, Building2, Trophy, XCircle,
  CalendarDays, UserCog, Award, Sparkles,
} from 'lucide-react'
import type { SalesExecutiveMetrics } from '@/types'

function formatMoney(n: number): string {
  return n >= 1_000_000 ? `৳${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `৳${(n / 1_000).toFixed(0)}K` : `৳${n.toLocaleString('en-BD')}`
}

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
      <p className="text-2xl sm:text-3xl font-bold tabular-nums text-foreground truncate">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function AchievementBar({ pct }: { pct: number }) {
  const capped = Math.min(pct, 100)
  const color = pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-primary' : pct >= 30 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="space-y-1.5">
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${capped}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{pct}% of target achieved</span>
        {pct >= 100 && <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Sparkles className="h-3 w-3" /> Target reached</span>}
      </div>
    </div>
  )
}

export function SalesPerformanceDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const { data: metrics, isLoading } = useQuery<SalesExecutiveMetrics>({
    queryKey: ['sales-executive-metrics', session.userId],
    queryFn: () => dp.getSalesExecutiveMetrics(session.userId, scope),
    staleTime: 30_000,
  })

  const { data: assignedBy } = useQuery({
    queryKey: ['user', metrics?.target?.assigned_by],
    queryFn: () => dp.getUser(metrics!.target!.assigned_by),
    enabled: !!metrics?.target?.assigned_by,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!metrics) return null

  const { target, achieved_amount, achievement_pct, pipeline_value, active_prospects, deals_won, deals_lost, win_rate_pct, active_clients, last_deal } = metrics

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Sales Target"
          value={target ? formatMoney(target.target_amount) : '—'}
          sub={target ? target.period_label : 'No target assigned'}
          icon={Target}
        />
        <MetricCard
          label="Achieved"
          value={formatMoney(achieved_amount)}
          sub={achievement_pct != null ? `${achievement_pct}% of target` : `${deals_won} deal${deals_won !== 1 ? 's' : ''} won`}
          icon={Wallet}
        />
        <MetricCard
          label="Pipeline Value"
          value={formatMoney(pipeline_value)}
          sub={`${active_prospects} active prospect${active_prospects !== 1 ? 's' : ''}`}
          icon={TrendingUp}
        />
        <MetricCard
          label="Active Clients"
          value={String(active_clients)}
          sub="Accounts under management"
          icon={Building2}
        />
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Target & achievement */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Target Achievement</p>
          {target ? (
            <>
              <AchievementBar pct={achievement_pct ?? 0} />
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="rounded-lg bg-muted/40 p-2.5 space-y-0.5">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                    <CalendarDays className="h-3 w-3" /> Assigned
                  </div>
                  <p className="text-sm font-bold text-foreground">{formatDate(target.assigned_at)}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5 space-y-0.5">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                    <UserCog className="h-3 w-3" /> Assigned By
                  </div>
                  <p className="text-sm font-bold text-foreground truncate">{assignedBy?.name ?? '—'}</p>
                </div>
              </div>
              {target.notes && (
                <p className="text-xs text-muted-foreground border-t pt-2.5">{target.notes}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic py-2">No target has been assigned yet. Reach out to your Technical Head to get one set.</p>
          )}
        </div>

        {/* Deal outcomes */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Deal Outcomes</p>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-2.5 space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 uppercase tracking-wide font-semibold">
                <Trophy className="h-3 w-3" /> Won
              </div>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{deals_won}</p>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-2.5 space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] text-red-700 dark:text-red-400 uppercase tracking-wide font-semibold">
                <XCircle className="h-3 w-3" /> Lost
              </div>
              <p className="text-lg font-bold text-red-700 dark:text-red-400">{deals_lost}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t pt-2.5">
            <Award className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {win_rate_pct != null ? <span><strong className="text-foreground">{win_rate_pct}%</strong> win rate</span> : 'No closed deals yet'}
          </div>

          {last_deal && (
            <div className="rounded-lg bg-muted/40 p-2.5 space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Last Deal Closed</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground truncate">{last_deal.company_name}</p>
                <p className="text-sm font-bold text-primary shrink-0">{formatMoney(last_deal.value)}</p>
              </div>
              <p className="text-[10px] text-muted-foreground">{formatDate(last_deal.closed_at)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
