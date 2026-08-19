'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { StatCard } from '@/components/shared/stat-card'
import { CertificationCard } from '@/components/shared/certification-card'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { cn, timeAgo, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/utils'
import {
  Ticket, LayoutList, Undo2, Hourglass, Star, Wrench, MessageSquare, ExternalLink,
  Lock, Clock3, Trophy, CheckCircle2, Target, Award, ArrowRight, Check,
} from 'lucide-react'
import type { EngineerMetrics } from '@/types'

const OPEN_STATUSES = new Set(['new', 'triaged', 'assigned', 'in_progress', 'pending_client', 'escalated'])
const DONE_STATUSES = new Set(['resolved', 'pending_closure', 'closed'])
const DAY_MS = 86_400_000
const WEEKS_BACK = 8

// A case's time_intervals (populated via the sub-case timer controls) is the
// only real per-day worked-time signal we have — clip each interval to the
// requested day window so a session spanning midnight splits correctly.
function clippedIntervalMs(intervals: { start: string; end?: string }[] | undefined, dayStart: number, dayEnd: number, nowMs: number): number {
  if (!intervals) return 0
  return intervals.reduce((total, iv) => {
    const s = Math.max(new Date(iv.start).getTime(), dayStart)
    const e = Math.min(iv.end ? new Date(iv.end).getTime() : nowMs, dayEnd)
    return total + Math.max(0, e - s)
  }, 0)
}

export function EngineerWidgets() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }
  const [nowMs] = useState(() => Date.now())
  const [hoursTab, setHoursTab] = useState<'weekly' | 'weekwise'>('weekly')

  const { data: casesPage, isLoading: casesLoading } = useQuery({
    queryKey: ['cases', 'engineer', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 500 }),
    refetchInterval: 30_000,
  })
  // Still-unassigned cases routed to my team — merged into Queuing Cases below
  // so I can grab one directly, no Team Lead / Technical Head approval needed.
  const { data: claimable } = useQuery({
    queryKey: ['claimable-cases', session.userId],
    queryFn: () => dp.listClaimableCases(scope),
    refetchInterval: 30_000,
  })
  const claimCase = useMutation({
    mutationFn: (caseId: string) => dp.claimCase(caseId, scope),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases'] })
      qc.invalidateQueries({ queryKey: ['claimable-cases'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast({ title: 'Case assigned to you', variant: 'success' })
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: comments } = useQuery({
    queryKey: ['comments', 'recent', session.userId],
    queryFn: () => dp.listRecentComments(scope),
    refetchInterval: 30_000,
  })
  const { data: metrics, isLoading: metricsLoading } = useQuery<EngineerMetrics>({
    queryKey: ['engineer-metrics', session.userId],
    queryFn: () => dp.getEngineerMetrics(session.userId, scope),
    staleTime: 30_000,
  })

  const cases = useMemo(() => casesPage?.items ?? [], [casesPage])
  const myUser = useMemo(() => (users ?? []).find((u) => u.id === session.userId), [users, session.userId])
  const usersMap = useMemo(() => Object.fromEntries((users ?? []).map((u) => [u.id, u])), [users])
  const casesMap = useMemo(() => Object.fromEntries(cases.map((c) => [c.id, c])), [cases])

  // ── Current-year case counts ────────────────────────────────────────────────
  const year = new Date(nowMs).getFullYear()
  const casesThisYear = useMemo(() => cases.filter((c) => new Date(c.created_at).getFullYear() === year), [cases, year])
  const totalThisYear = casesThisYear.length
  const openThisYear = useMemo(() => casesThisYear.filter((c) => OPEN_STATUSES.has(c.status)).length, [casesThisYear])
  const closureRejectedThisYear = useMemo(() => casesThisYear.filter((c) => c.closure_rejected).length, [casesThisYear])

  // Queuing = accepted but not yet started (status 'assigned'), plus any
  // still-unassigned cases routed to my team that I can grab directly.
  const queuingCases = useMemo(
    () => cases.filter((c) => c.status === 'assigned').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [cases]
  )
  const claimableIds = useMemo(() => new Set((claimable ?? []).map((c) => c.id)), [claimable])
  const queueRows = useMemo(
    () => [...(claimable ?? []), ...queuingCases],
    [claimable, queuingCases]
  )

  // Solutions provided — resolved cases where you actually recorded a fix.
  const solutionsProvided = useMemo(
    () => cases.filter((c) => !!c.resolution_solution && c.resolution_solution.trim().length > 0).length,
    [cases]
  )

  // Successful POC — critical/high-priority cases proven out with a recorded fix.
  const successfulPOC = useMemo(
    () => cases.filter((c) => DONE_STATUSES.has(c.status) && ['critical', 'high'].includes(c.priority) && !!c.resolution_solution).length,
    [cases]
  )

  // ── Case Updates — comment activity across your own cases ──────────────────
  const recentUpdates = useMemo(() => (comments ?? []).slice(0, 10), [comments])

  // ── Weekly workhours — last 7 days, from real time_intervals ────────────────
  const weeklyDays = useMemo(() => {
    return [...Array(7)].map((_, i) => {
      const dayStart = new Date(nowMs)
      dayStart.setHours(0, 0, 0, 0)
      dayStart.setDate(dayStart.getDate() - (6 - i))
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      const ms = cases.reduce((sum, c) => sum + clippedIntervalMs(c.time_intervals, dayStart.getTime(), dayEnd.getTime(), nowMs), 0)
      return { label: dayStart.toLocaleDateString('en-US', { weekday: 'short' }), hours: ms / 3_600_000 }
    })
  }, [cases, nowMs])
  const totalWeeklyHours = useMemo(() => weeklyDays.reduce((s, d) => s + d.hours, 0), [weeklyDays])
  const maxDayHours = Math.max(1, ...weeklyDays.map((d) => d.hours))

  // ── Week-wise workload — hours + distinct cases touched, last 8 weeks ──────
  const weekStartAnchor = useMemo(() => {
    const d = new Date(nowMs)
    d.setHours(0, 0, 0, 0)
    const dow = (d.getDay() + 6) % 7 // Mon=0 .. Sun=6
    d.setDate(d.getDate() - dow) // this week's Monday
    return d.getTime()
  }, [nowMs])
  const weeklyTrend = useMemo(() => {
    return [...Array(WEEKS_BACK)].map((_, i) => {
      const weekStart = weekStartAnchor - (WEEKS_BACK - 1 - i) * 7 * DAY_MS
      const weekEnd = weekStart + 7 * DAY_MS
      const hoursMs = cases.reduce((sum, c) => sum + clippedIntervalMs(c.time_intervals, weekStart, weekEnd, nowMs), 0)
      const caseCount = cases.filter((c) => (c.time_intervals ?? []).some((iv) => {
        const s = new Date(iv.start).getTime()
        const e = iv.end ? new Date(iv.end).getTime() : nowMs
        return s < weekEnd && e > weekStart
      })).length
      return {
        label: new Date(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        hours: hoursMs / 3_600_000,
        cases: caseCount,
        isCurrent: i === WEEKS_BACK - 1,
      }
    })
  }, [cases, weekStartAnchor, nowMs])
  const maxWeekHours = Math.max(1, ...weeklyTrend.map((w) => w.hours))

  if (casesLoading) {
    return <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="Total Cases" value={totalThisYear} subtitle={`${year}`} icon={Ticket} iconColor="text-sky-600 dark:text-sky-400" />
        <StatCard title="Open Cases" value={openThisYear} subtitle={`${year}`} icon={LayoutList} iconColor="text-blue-600 dark:text-blue-400" />
        <StatCard title="Closure Rejected" value={closureRejectedThisYear} subtitle={`${year}`} icon={Undo2} iconColor="text-orange-600 dark:text-orange-400" />
        <CertificationCard level={myUser?.certification_level} years={myUser?.years_of_experience} />
        <StatCard
          title="Customer Satisfaction"
          value={metrics?.satisfaction_score != null ? `${metrics.satisfaction_score}/5` : '—'}
          subtitle={metrics ? `${metrics.total_feedback_count} rating${metrics.total_feedback_count !== 1 ? 's' : ''}` : undefined}
          icon={Star}
          iconColor="text-amber-500"
          loading={metricsLoading}
        />
        <StatCard title="Solutions Provided" value={solutionsProvided} icon={Wrench} iconColor="text-emerald-600 dark:text-emerald-400" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Weekly workhours */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b flex-wrap">
            <Clock3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground flex-1 min-w-0">
              {hoursTab === 'weekly' ? 'Weekly Workhours' : 'Week-wise Workload'}
            </h3>
            <span className="text-xs text-muted-foreground shrink-0">
              {hoursTab === 'weekly' ? `${totalWeeklyHours.toFixed(1)}h this week` : `last ${WEEKS_BACK} weeks`}
            </span>
            <div className="flex items-center gap-1 w-full sm:w-auto sm:shrink-0">
              {([
                { key: 'weekly',   label: 'Weekly' },
                { key: 'weekwise', label: 'Week-wise' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setHoursTab(key)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
                    hoursTab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {hoursTab === 'weekly' ? (
            <div className="p-4 flex items-end gap-2 h-40">
              {weeklyDays.map((d) => (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[10px] font-semibold text-foreground tabular-nums">{d.hours > 0 ? d.hours.toFixed(1) : ''}</span>
                  <div className="w-full rounded-t-md bg-muted overflow-hidden flex items-end" style={{ height: '100%' }}>
                    <div
                      className="w-full rounded-t-md bg-primary/70 transition-all"
                      style={{ height: `${Math.round((d.hours / maxDayHours) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {weeklyTrend.map((w) => (
                <div key={w.label} className="flex items-center gap-2">
                  <span className={cn('text-xs w-14 shrink-0', w.isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                    {w.isCurrent ? 'This wk' : w.label}
                  </span>
                  <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', w.isCurrent ? 'bg-primary' : 'bg-primary/50')}
                      style={{ width: `${Math.round((w.hours / maxWeekHours) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-foreground tabular-nums w-12 text-right">{w.hours.toFixed(1)}h</span>
                  <span className="text-[11px] text-muted-foreground w-14 shrink-0">{w.cases} case{w.cases !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Performance */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground flex-1">My Performance</h3>
            <Link href="/my-case?tab=performance" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Details <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {metricsLoading ? (
            <div className="grid grid-cols-2 gap-2.5 p-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
            </div>
          ) : metrics ? (
            <div className="grid grid-cols-2 gap-2.5 p-4">
              <PerfTile icon={<Award className="h-3.5 w-3.5 text-violet-500" />} label="Certification" value={myUser?.certification_level ?? '—'} />
              <PerfTile icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />} label="Resolved Cases" value={String(metrics.total_resolved)} />
              <PerfTile icon={<Target className="h-3.5 w-3.5 text-blue-400" />} label="Successful POC" value={String(successfulPOC)} />
              <PerfTile icon={<Trophy className="h-3.5 w-3.5 text-amber-400" />} label="Community Points" value={String(metrics.points)} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Case Updates — comment activity across your own cases */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Case Updates</h3>
            <span className="text-xs text-muted-foreground ml-auto">across your cases · continues updating</span>
          </div>
          {recentUpdates.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No case comments yet</p>
          ) : (
            <div className="divide-y max-h-96 overflow-y-auto">
              {recentUpdates.map((c) => {
                const author = usersMap[c.author_id]
                const parentCase = casesMap[c.case_id]
                return (
                  <div key={c.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{author?.name ?? c.author_id}</span>
                        {c.is_internal && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                            <Lock className="h-2.5 w-2.5" /> Internal
                          </span>
                        )}
                        {parentCase && <span className="font-mono text-[11px] text-muted-foreground">{parentCase.reference_no}</span>}
                        <span className="text-[11px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{c.body}</p>
                    </div>
                    {parentCase && (
                      <Link href={`/cases/${parentCase.id}`} className="shrink-0 text-muted-foreground hover:text-foreground p-1" title="View case">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Queuing Cases — accepted-but-not-started, plus unassigned team cases to grab */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Hourglass className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <h3 className="text-sm font-semibold text-foreground">Queuing Cases</h3>
            <span className="text-xs text-muted-foreground ml-auto">{queueRows.length} waiting</span>
          </div>
          {queueRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nothing waiting to be started</p>
          ) : (
            <div className="divide-y max-h-96 overflow-y-auto">
              {queueRows.map((c) => {
                const isClaimable = claimableIds.has(c.id)
                return (
                  <Link key={c.id} href={`/cases/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] text-muted-foreground">{c.reference_no}</span>
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', PRIORITY_COLORS[c.priority])}>
                          {PRIORITY_LABELS[c.priority]}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                    </div>
                    {isClaimable ? (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                        disabled={claimCase.isPending}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); claimCase.mutate(c.id) }}
                      >
                        <Check className="h-3.5 w-3.5" /> Grab Case
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(c.created_at)}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PerfTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className={cn('rounded-lg border bg-muted/30 p-3 space-y-1')}>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon}<span className="truncate">{label}</span></div>
      <p className="text-lg font-bold text-foreground leading-none tabular-nums">{value}</p>
    </div>
  )
}
