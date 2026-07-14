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
import type { Case } from '@/types'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type SeriesKey = 'opened' | 'solved' | 'reopened' | 'escalated'

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'opened',    label: 'Opened',    color: '#3b82f6' },
  { key: 'solved',    label: 'Solved',    color: '#10b981' },
  { key: 'reopened',  label: 'Reopened',  color: '#f59e0b' },
  { key: 'escalated', label: 'Escalated', color: '#ef4444' },
]

type Period = '12m' | '6m' | '3m' | '1m' | 'week' | 'custom'

const PERIOD_TABS: { value: Period; label: string; title: string }[] = [
  { value: '12m',    label: '12 Months', title: 'Last 12 Months' },
  { value: '6m',     label: '6 Months',  title: 'Last 6 Months' },
  { value: '3m',     label: '3 Months',  title: 'Last 3 Months' },
  { value: '1m',     label: '1 Month',   title: 'Last 30 Days' },
  { value: 'week',   label: 'Week',      title: 'Last 7 Days' },
  { value: 'custom', label: 'Custom',    title: 'Custom Range' },
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

function emptyBucket(label: string, start: Date, end: Date): Bucket {
  return { label, start: start.getTime(), end: end.getTime(), opened: 0, solved: 0, reopened: 0, escalated: 0 }
}

function monthlyBuckets(monthsCount: number, now: Date): Bucket[] {
  const buckets: Bucket[] = []
  for (let i = monthsCount - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    buckets.push(emptyBucket(`${MONTH_LABELS[start.getMonth()]} ${String(start.getFullYear()).slice(2)}`, start, end))
  }
  return buckets
}

function dailyBuckets(from: Date, to: Date): Bucket[] {
  const buckets: Bucket[] = []
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  while (cursor.getTime() <= last.getTime()) {
    const start = new Date(cursor)
    const end = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
    buckets.push(emptyBucket(`${MONTH_LABELS[start.getMonth()]} ${start.getDate()}`, start, end))
    cursor.setDate(cursor.getDate() + 1)
  }
  return buckets
}

// Today back to the previous 6 days, labeled by weekday name (today's weekday
// shifts daily, so the labels are always relative to "now").
function weekBuckets(now: Date): Bucket[] {
  const buckets: Bucket[] = []
  for (let i = 6; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
    buckets.push(emptyBucket(WEEKDAY_LABELS[start.getDay()], start, end))
  }
  return buckets
}

// Custom ranges bucket by day when short enough to stay readable, otherwise by month.
function customBuckets(fromStr: string, toStr: string): Bucket[] {
  if (!fromStr || !toStr) return []
  const from = new Date(fromStr)
  const to = new Date(toStr)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from.getTime() > to.getTime()) return []

  const daySpan = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
  if (daySpan <= 45) return dailyBuckets(from, to)

  const buckets: Bucket[] = []
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
  const last = new Date(to.getFullYear(), to.getMonth(), 1)
  while (cursor.getTime() <= last.getTime()) {
    const start = new Date(cursor)
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    buckets.push(emptyBucket(`${MONTH_LABELS[start.getMonth()]} ${String(start.getFullYear()).slice(2)}`, start, end))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return buckets
}

function buildBuckets(period: Period, customFrom: string, customTo: string, nowMs: number): Bucket[] {
  const now = new Date(nowMs)
  if (period === '12m') return monthlyBuckets(12, now)
  if (period === '6m') return monthlyBuckets(6, now)
  if (period === '3m') return monthlyBuckets(3, now)
  if (period === '1m') {
    const from = new Date(now)
    from.setDate(from.getDate() - 29)
    return dailyBuckets(from, now)
  }
  if (period === 'week') return weekBuckets(now)
  return customBuckets(customFrom, customTo)
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
        <div className="sm:ml-auto flex flex-wrap gap-x-3 gap-y-1">
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