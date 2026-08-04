'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { StatCard } from '@/components/shared/stat-card'
import { cn, formatDateTime, timeAgo, matchesQuickFilter } from '@/lib/utils'
import type { CaseQuickFilter } from '@/lib/utils'
import {
  AlertTriangle, Hourglass, Undo2, CalendarClock, MessageSquare,
  Trophy, TrendingDown, Users, ShieldX, Star, LayoutList, ExternalLink, Lock,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { EngineerMetrics, ProductLicense } from '@/types'

const OPEN_STATUSES = new Set(['new', 'triaged', 'assigned', 'in_progress', 'pending_client', 'escalated'])
const DAY_MS = 86_400_000
const EXPIRY_SOON_DAYS = 7

// Each card deep-links to /cases?quick=<key> — dp.listCases already scopes a
// team lead's cases to their own team, so the filtered list lands pre-scoped.
const BUCKETS: { key: CaseQuickFilter; label: string; icon: LucideIcon; iconColor: string; subtitle?: string }[] = [
  { key: 'escalated',        label: 'Escalated Cases',        icon: AlertTriangle,  iconColor: 'text-red-600 dark:text-red-400' },
  { key: 'closure_rejected', label: 'Closure Rejected Cases', icon: Undo2,          iconColor: 'text-orange-600 dark:text-orange-400' },
  { key: 'long_queue',       label: 'Queuing Cases',          icon: Hourglass,      iconColor: 'text-violet-600 dark:text-violet-400', subtitle: 'unassigned > 24h' },
  { key: 'long_running',     label: '3+ Months Running Cases', icon: CalendarClock,  iconColor: 'text-blue-600 dark:text-blue-400' },
]

function expiryLabel(days: number): string {
  if (days < 0) return `Expired ${-days}d ago`
  if (days === 0) return 'Expires today'
  return `${days}d left`
}

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

export function LeadTeamDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }
  const router = useRouter()
  const [nowMs] = useState(() => Date.now())
  const [workloadTab, setWorkloadTab] = useState<'most' | 'least'>('most')
  const [licenseTab, setLicenseTab] = useState<'expiring' | 'expired'>('expiring')

  const { data: casesPage, isLoading: casesLoading } = useQuery({
    queryKey: ['cases', 'lead', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 500 }),
    refetchInterval: 30_000,
  })
  const { data: users }    = useQuery({ queryKey: ['users'],            queryFn: () => dp.listUsers() })
  const { data: clients }  = useQuery({ queryKey: ['clients', scope],   queryFn: () => dp.listClients(scope) })
  const { data: products } = useQuery({ queryKey: ['products'],         queryFn: () => dp.listProducts() })
  const { data: licenses } = useQuery({ queryKey: ['product-licenses'], queryFn: () => dp.listProductLicenses() })
  const { data: comments } = useQuery({
    queryKey: ['comments', 'recent', session.userId],
    queryFn: () => dp.listRecentComments(scope),
    refetchInterval: 30_000,
  })
  // Shared query key with any per-team performance view — warms its cache too.
  const { data: metrics } = useQuery<EngineerMetrics[]>({
    queryKey: ['all-engineer-metrics'],
    queryFn: () => dp.listAllEngineerMetrics(scope),
    staleTime: 30_000,
  })

  const cases = useMemo(() => casesPage?.items ?? [], [casesPage])
  const myUser = useMemo(() => (users ?? []).find((u) => u.id === session.userId), [users, session.userId])
  const myTeamId = myUser?.team_id

  const usersMap    = useMemo(() => Object.fromEntries((users    ?? []).map((u) => [u.id, u])),              [users])
  const clientsMap  = useMemo(() => Object.fromEntries((clients  ?? []).map((c) => [c.id, c.company_name])), [clients])
  const productsMap = useMemo(() => Object.fromEntries((products ?? []).map((p) => [p.id, p.name])),         [products])
  const casesMap    = useMemo(() => Object.fromEntries(cases.map((c) => [c.id, c])),                         [cases])

  const openCount = useMemo(() => cases.filter((c) => OPEN_STATUSES.has(c.status)).length, [cases])

  // ── Attention bucket counts — cases are already team-scoped by dp.listCases.
  const bucketCounts = useMemo<Record<CaseQuickFilter, number>>(() => {
    const counts: Record<CaseQuickFilter, number> = { escalated: 0, reopened: 0, closure_rejected: 0, long_queue: 0, long_running: 0 }
    for (const c of cases) {
      for (const key of Object.keys(counts) as CaseQuickFilter[]) {
        if (matchesQuickFilter(c, key, nowMs)) counts[key]++
      }
    }
    return counts
  }, [cases, nowMs])

  // ── Case updates — engineer comment activity across the team's cases. ──────
  const recentUpdates = useMemo(() => (comments ?? []).slice(0, 10), [comments])

  // ── License & SLA expiry — scoped to clients this team actually serves. ────
  const teamClientIds = useMemo(() => new Set(cases.map((c) => c.client_id)), [cases])
  const expiryRows = useMemo(() => {
    return (licenses ?? [])
      .filter((l: ProductLicense) => teamClientIds.has(l.client_id))
      .flatMap((l: ProductLicense) => [
        { id: `${l.id}-license`, kind: 'License' as const, expires_at: l.license_expires_at, client_id: l.client_id, product_id: l.product_id },
        { id: `${l.id}-sla`,     kind: 'SLA'     as const, expires_at: l.sla_expires_at,     client_id: l.client_id, product_id: l.product_id },
      ])
      .map((r) => ({ ...r, days: Math.floor((new Date(r.expires_at).getTime() - nowMs) / DAY_MS) }))
      .filter((r) => r.days <= EXPIRY_SOON_DAYS)
      .sort((a, b) => a.days - b.days)
  }, [licenses, teamClientIds, nowMs])
  const expired      = useMemo(() => expiryRows.filter((r) => r.days < 0), [expiryRows])
  const expiringSoon = useMemo(() => expiryRows.filter((r) => r.days >= 0), [expiryRows])

  // ── Team engineer performance (ranked by earned points) ────────────────────
  const teamEngineerIds = useMemo(
    () => new Set((users ?? []).filter((u) => u.role === 'support_engineer' && u.team_id === myTeamId && u.is_active).map((u) => u.id)),
    [users, myTeamId]
  )
  const rankedEngineers = useMemo(
    () => (metrics ?? []).filter((m) => teamEngineerIds.has(m.engineer_id)).sort((a, b) => b.points - a.points),
    [metrics, teamEngineerIds]
  )
  const topEngineers = useMemo(() => rankedEngineers.slice(0, 3), [rankedEngineers])
  const lowEngineers = useMemo(
    () => rankedEngineers.slice(Math.max(3, rankedEngineers.length - 3)).reverse(),
    [rankedEngineers]
  )

  // ── Engineer workload distribution — active (open) case count, this team only.
  const engineerWorkload = useMemo(() => {
    const engineers = (users ?? []).filter((u) => u.role === 'support_engineer' && u.team_id === myTeamId && u.is_active)
    return engineers.map((u) => ({
      id: u.id,
      name: u.name,
      active: cases.filter((c) => c.assignee_id === u.id && OPEN_STATUSES.has(c.status)).length,
    }))
  }, [users, myTeamId, cases])
  const mostWorkload  = useMemo(() => [...engineerWorkload].sort((a, b) => b.active - a.active).slice(0, 8), [engineerWorkload])
  const leastWorkload = useMemo(() => [...engineerWorkload].sort((a, b) => a.active - b.active).slice(0, 8), [engineerWorkload])
  const maxActive = Math.max(1, ...engineerWorkload.map((e) => e.active))
  const workloadRows = workloadTab === 'most' ? mostWorkload : leastWorkload

  if (casesLoading) {
    return <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
  }

  return (
    <div className="space-y-6">
      {/* KPIs — bucket cards jump to Cases pre-filtered (already team-scoped) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard title="Open Cases" value={openCount} icon={LayoutList} iconColor="text-sky-600 dark:text-sky-400" />
        {BUCKETS.map(({ key, label, icon, iconColor, subtitle }) => (
          <button
            key={key}
            type="button"
            onClick={() => router.push(`/cases?quick=${key}`)}
            className={cn(
              'text-left rounded-xl cursor-pointer transition-all duration-150',
              'hover:shadow-md hover:-translate-y-0.5 hover:ring-1 hover:ring-primary/30',
              'active:translate-y-0 active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
            )}
          >
            <StatCard title={label} value={bucketCounts[key]} subtitle={subtitle} icon={icon} iconColor={iconColor} />
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* License & SLA expiry */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b flex-wrap">
            <ShieldX className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            <h3 className="text-sm font-semibold text-foreground flex-1 min-w-0">License &amp; SLA Expiry</h3>
            <div className="flex items-center gap-1 shrink-0">
              {([
                { key: 'expiring', label: `Expiring ≤ ${EXPIRY_SOON_DAYS}d`, count: expiringSoon.length },
                { key: 'expired',  label: 'Already Expired',                 count: expired.length },
              ] as const).map(({ key, label, count }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLicenseTab(key)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
                    licenseTab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
          </div>
          {(licenseTab === 'expiring' ? expiringSoon : expired).length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {licenseTab === 'expiring' ? `Nothing expiring within ${EXPIRY_SOON_DAYS} days` : 'Nothing expired'}
            </p>
          ) : (
            <div className="divide-y max-h-56 overflow-y-auto">
              {(licenseTab === 'expiring' ? expiringSoon : expired).map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 w-14 text-center',
                    r.kind === 'License'
                      ? 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40'
                      : 'text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/40'
                  )}>
                    {r.kind}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{productsMap[r.product_id] ?? r.product_id}</p>
                    <p className="text-xs text-muted-foreground truncate">{clientsMap[r.client_id] ?? r.client_id}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('text-xs font-semibold', r.days < 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>
                      {expiryLabel(r.days)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{formatDateTime(r.expires_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Engineer workload distribution */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b flex-wrap">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground flex-1 min-w-0">Engineer Workload Distribution</h3>
            <div className="flex items-center gap-1 shrink-0">
              {([
                { key: 'most',  label: 'Most Workload' },
                { key: 'least', label: 'Least Workload' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setWorkloadTab(key)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
                    workloadTab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {workloadRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No active engineers in this team</p>
          ) : (
            <div className="p-4 space-y-2.5">
              {workloadRows.map((e) => (
                <div key={e.id} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-28 truncate shrink-0" title={e.name}>{e.name}</span>
                  <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', e.active >= 4 ? 'bg-red-500' : e.active >= 2 ? 'bg-amber-500' : 'bg-primary')}
                      style={{ width: `${Math.round((e.active / maxActive) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-foreground tabular-nums w-16 text-right">{e.active} active</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Engineer performance extremes — this team only */}
      <div className="grid lg:grid-cols-2 gap-6">
        {[
          { title: 'Top Performing Engineers', icon: Trophy,       iconColor: 'text-emerald-600 dark:text-emerald-400', rows: topEngineers, empty: 'No engineer metrics yet' },
          { title: 'Low Performing Engineers', icon: TrendingDown, iconColor: 'text-red-600 dark:text-red-400',         rows: lowEngineers, empty: 'Not enough engineers to rank' },
        ].map(({ title, icon: Icon, iconColor, rows, empty }) => (
          <div key={title} className="rounded-xl border bg-card">
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <Icon className={cn('h-4 w-4', iconColor)} />
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            </div>
            {rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>
            ) : (
              <div className="divide-y">
                {rows.map((m) => {
                  const u = usersMap[m.engineer_id]
                  return (
                    <div key={m.engineer_id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{u?.name ?? m.engineer_id}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.total_resolved} resolved · {m.open_cases} open · SLA {m.sla_compliance_pct}%
                        </p>
                      </div>
                      <StarRow score={m.satisfaction_score} />
                      <span className="text-sm font-bold tabular-nums text-foreground w-14 text-right">{m.points} pts</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Case Updates — engineer activity across the team's cases */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Case Updates</h3>
          <span className="text-xs text-muted-foreground ml-auto">across all cases · continues updating from engineers</span>
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
    </div>
  )
}
