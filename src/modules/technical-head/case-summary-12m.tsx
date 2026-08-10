'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildDateBuckets, PERIOD_TABS, type Period } from '@/lib/date-buckets'
import type { Case } from '@/types'

type SeriesKey = 'opened' | 'solved' | 'reopened' | 'escalated'

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'opened',    label: 'Opened',    color: '#3b82f6' },
  { key: 'solved',    label: 'Solved',    color: '#10b981' },
  { key: 'reopened',  label: 'Reopened',  color: '#f59e0b' },
  { key: 'escalated', label: 'Escalated', color: '#ef4444' },
]

interface Bucket {
  label: string
  start: number
  end: number
  opened: number
  solved: number
  reopened: number
  escalated: number
}

function buildBuckets(period: Period, customFrom: string, customTo: string, nowMs: number): Bucket[] {
  return buildDateBuckets(period, customFrom, customTo, nowMs).map((b) => ({
    ...b, opened: 0, solved: 0, reopened: 0, escalated: 0,
  }))
}

/**
 * Technical-Head dashboard widget: case activity (opened / solved / reopened /
 * escalated) bucketed over a selectable window — 12/6/3 rolling months, the
 * last 30 days, or a custom date range. Rendered via a client-only dynamic
 * import so recharts stays out of SSR.
 */
export function CaseSummary12m() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesPage, isLoading } = useQuery({
    queryKey: ['cases', 'all-teams', '12m-summary'],
    queryFn: () => dp.listCases(scope, { pageSize: 500 }),
  })

  // Capture "now" once at mount so the rolling windows stay stable across renders.
  const [nowMs] = useState(() => Date.now())
  const [period, setPeriod] = useState<Period>('12m')
  const todayStr = useMemo(() => new Date(nowMs).toISOString().slice(0, 10), [nowMs])
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(nowMs)
    d.setDate(d.getDate() - 29)
    return d.toISOString().slice(0, 10)
  })
  const [customTo, setCustomTo] = useState(todayStr)

  const { data, totals } = useMemo(() => {
    const cases: Case[] = casesPage?.items ?? []
    const buckets = buildBuckets(period, customFrom, customTo, nowMs)

    const bump = (dateStr: string | undefined, field: SeriesKey) => {
      if (!dateStr) return
      const t = new Date(dateStr).getTime()
      const bucket = buckets.find((b) => t >= b.start && t < b.end)
      if (bucket) bucket[field] += 1
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
  }, [casesPage, nowMs, period, customFrom, customTo])

  const activeTab = PERIOD_TABS.find((t) => t.value === period)!
  const tickInterval = data.length > 16 ? Math.ceil(data.length / 12) - 1 : 0

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
        <h3 className="text-sm font-semibold text-foreground">{activeTab.title} — Case Summary</h3>

        <div className="flex items-center gap-3 flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-1 sm:ml-auto  px-.5 ">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
              {s.label} <span className="font-semibold text-foreground tabular-nums">{totals[s.key]}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="min-w-0">
          <TabsList className="max-w-full overflow-x-auto justify-start">
            {PERIOD_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="shrink-0">{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {period === 'custom' && (
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayStr}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="h-[220px] sm:h-[280px] rounded-lg bg-muted animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-[220px] sm:h-[280px] flex items-center justify-center text-sm text-muted-foreground">
          Select a valid date range
        </div>
      ) : (
        <div className="h-[220px] sm:h-[280px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="16%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={tickInterval} tickMargin={6} />
              <YAxis tick={{ fontSize: 11 }} width={32} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} content={<SummaryTooltip />} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              {SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
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