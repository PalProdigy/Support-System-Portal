'use client'

import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts'
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildDateBuckets, PERIOD_TABS, type Period } from '@/lib/date-buckets'
import type { Case } from '@/types'

interface Bucket {
  label: string
  start: number
  end: number
  resolved: number
}

function buildBuckets(period: Period, customFrom: string, customTo: string, nowMs: number): Bucket[] {
  return buildDateBuckets(period, customFrom, customTo, nowMs).map((b) => ({ ...b, resolved: 0 }))
}

// Deterministic pseudo-random count (stable across re-renders) so every period
// tab always has bars to show, even before real resolution data exists.
function sampleValue(seed: string, min: number, max: number): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  const rand = Math.abs(hash % 1000) / 1000
  return Math.round(min + rand * (max - min))
}

function withSampleData(period: Period, buckets: Bucket[]): Bucket[] {
  return buckets.map((b, i) => ({ ...b, resolved: sampleValue(`${period}-${b.label}-${i}`, 1, 14) }))
}

/**
 * Team workspace widget: cases this team resolved, bucketed over a
 * selectable window — 12/6/3 rolling months, the last 30 days, the last
 * 7 days, or a custom date range. Mirrors the Technical Head dashboard's
 * case-summary chart, scoped to a single team's resolved cases.
 */
export function TeamMonthlyActivity({ cases }: { cases: Case[] }) {
  const [nowMs] = useState(() => Date.now())
  const [period, setPeriod] = useState<Period>('12m')
  const todayStr = useMemo(() => new Date(nowMs).toISOString().slice(0, 10), [nowMs])
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(nowMs)
    d.setDate(d.getDate() - 29)
    return d.toISOString().slice(0, 10)
  })
  const [customTo, setCustomTo] = useState(todayStr)

  const { data, total, isSample } = useMemo(() => {
    const buckets = buildBuckets(period, customFrom, customTo, nowMs)
    for (const c of cases) {
      if (c.status !== 'resolved' && c.status !== 'closed' && c.status !== 'pending_closure') continue
      const dateStr = c.closed_at ?? c.resolved_at
      if (!dateStr) continue
      const t = new Date(dateStr).getTime()
      const bucket = buckets.find((b) => t >= b.start && t < b.end)
      if (bucket) bucket.resolved += 1
    }
    const realTotal = buckets.reduce((s, b) => s + b.resolved, 0)
    if (realTotal === 0 && buckets.length > 0) {
      const sampled = withSampleData(period, buckets)
      return { data: sampled, total: sampled.reduce((s, b) => s + b.resolved, 0), isSample: true }
    }
    return { data: buckets, total: realTotal, isSample: false }
  }, [cases, nowMs, period, customFrom, customTo])

  const activeTab = PERIOD_TABS.find((t) => t.value === period)!
  const tickInterval = data.length > 16 ? Math.ceil(data.length / 12) - 1 : 0

  const current = data[data.length - 1]
  const previous = data[data.length - 2]
  const delta = current && previous ? current.resolved - previous.resolved : null

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 min-w-0">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-semibold text-foreground truncate">{activeTab.title} — Resolved Cases</p>
              {isSample && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                  Sample data
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Cases resolved by this team · <span className="font-semibold text-foreground tabular-nums">{total}</span> total
            </p>
          </div>
        </div>
        {delta != null && (
          <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold shrink-0 ${
            delta > 0 ? 'bg-emerald-500/10 text-emerald-600'
            : delta < 0 ? 'bg-red-500/10 text-red-600'
            : 'bg-muted text-muted-foreground'}`}>
            {delta > 0 ? <TrendingUp className="h-3 w-3" />
              : delta < 0 ? <TrendingDown className="h-3 w-3" />
              : <Minus className="h-3 w-3" />}
            {delta > 0 ? `+${delta}` : delta} vs previous
          </div>
        )}
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

      {data.length === 0 ? (
        <div className="h-[220px] sm:h-[280px] flex items-center justify-center text-sm text-muted-foreground">
          Select a valid date range
        </div>
      ) : (
        <div className="h-[220px] sm:h-[280px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -12 }} barCategoryGap="16%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={tickInterval} tickMargin={6} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} width={32} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                formatter={(value) => {
                  const n = Number(value)
                  return [`${n} case${n !== 1 ? 's' : ''}`, 'Resolved']
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32}>
                <LabelList
                  dataKey="resolved"
                  position="top"
                  style={{ fontSize: 11, fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
