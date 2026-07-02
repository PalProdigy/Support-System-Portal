'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import type { Case } from '@/types'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type SeriesKey = 'opened' | 'solved' | 'reopened' | 'escalated'

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'opened',    label: 'Opened',    color: '#3b82f6' },
  { key: 'solved',    label: 'Solved',    color: '#10b981' },
  { key: 'reopened',  label: 'Reopened',  color: '#f59e0b' },
  { key: 'escalated', label: 'Escalated', color: '#ef4444' },
]

function monthKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`
}

/**
 * Technical-Head dashboard widget: a 12-month rolling summary of case activity
 * (opened / solved / reopened / escalated), bucketed by month. Rendered via a
 * client-only dynamic import so recharts stays out of SSR.
 */
export function CaseSummary12m() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesPage, isLoading } = useQuery({
    queryKey: ['cases', 'all-teams', '12m-summary'],
    queryFn: () => dp.listCases(scope, { pageSize: 500 }),
  })

  // Capture "now" once at mount so the month buckets stay stable across renders.
  const [nowMs] = useState(() => Date.now())

  const { data, totals } = useMemo(() => {
    const cases: Case[] = casesPage?.items ?? []
    const now = new Date(nowMs)

    // 12 rolling month buckets, oldest → current month.
    const buckets: { label: string; opened: number; solved: number; reopened: number; escalated: number }[] = []
    const index = new Map<string, number>()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      index.set(monthKey(d), buckets.length)
      buckets.push({
        label: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        opened: 0, solved: 0, reopened: 0, escalated: 0,
      })
    }

    const bump = (dateStr: string | undefined, field: SeriesKey) => {
      if (!dateStr) return
      const i = index.get(monthKey(new Date(dateStr)))
      if (i !== undefined) buckets[i][field] += 1
    }

    for (const c of cases) {
      bump(c.created_at, 'opened')
      // Solved = reached resolved/closed; bucket by when it completed.
      if (c.status === 'resolved' || c.status === 'closed') bump(c.closed_at ?? c.resolved_at, 'solved')
      // Reopened = a case spawned by reopening a closed one (bucket by its creation).
      if (c.reopened_from_case_id) bump(c.created_at, 'reopened')
      // Escalated = flagged/escalated cases; prefer the approval-escalation time.
      if (c.is_escalated || c.status === 'escalated') bump(c.approval_escalated_at ?? c.created_at, 'escalated')
    }

    const totals = buckets.reduce(
      (acc, b) => {
        acc.opened += b.opened; acc.solved += b.solved; acc.reopened += b.reopened; acc.escalated += b.escalated
        return acc
      },
      { opened: 0, solved: 0, reopened: 0, escalated: 0 } as Record<SeriesKey, number>,
    )

    return { data: buckets, totals }
  }, [casesPage, nowMs])

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Last 12 Months — Case Summary</h3>
        <div className="ml-auto flex flex-wrap gap-x-3 gap-y-1">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label} <span className="font-semibold text-foreground tabular-nums">{totals[s.key]}</span>
            </span>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-[280px] rounded-lg bg-muted animate-pulse" />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="16%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} tickMargin={6} />
            <YAxis tick={{ fontSize: 11 }} width={32} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} content={<SummaryTooltip />} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function SummaryTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  )
}
