'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { cn } from '@/lib/utils'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import {
  Building2, FolderKanban, Handshake, BadgeAlert, AlertTriangle,
  ShieldX, CheckCircle2, Ticket, Star, XCircle,
} from 'lucide-react'
import type { Client, Engagement, Project, ProductLicense, Product, Case, Solution, Feedback } from '@/types'

const ACTIVE_STATUSES = new Set(['new', 'triaged', 'assigned', 'in_progress', 'pending_client', 'escalated'])

const DAY_MS = 86_400_000
const EXPIRY_SOON_DAYS = 90

// Sales Executive's dashboard — mirrors exactly what's on their sidebar
// (Clients, Products, Projects, Engagements, License & SLA Monitoring), so
// every number here is a snapshot of a page they can actually navigate to.
// No Cases or Pipeline content — neither has a sidebar entry for this role.
export default function AMDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }
  const [nowMs] = useState(() => Date.now())

  const { data: clients, isLoading: clientsLoading, error, refetch } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
  })

  const { data: engagements, isLoading: engagementsLoading } = useQuery({
    queryKey: ['engagements', session.userId, session.role],
    queryFn: () => dp.listEngagements(scope),
  })

  const { data: allProjects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => dp.listProjects(scope),
  })

  const { data: licenses, isLoading: licensesLoading } = useQuery({
    queryKey: ['product-licenses'],
    queryFn: () => dp.listProductLicenses(),
  })

  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => dp.listProducts() })

  // View-only — sales_executive can see their clients' queuing cases but has
  // no assign action here (that's technical_head / team_lead territory).
  const { data: casesData, isLoading: casesLoading } = useQuery({
    queryKey: ['cases', 'am-queuing', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 500, top_level_only: true }),
  })
  const { data: solutions } = useQuery({ queryKey: ['solutions'], queryFn: () => dp.listSolutions() })
  const { data: feedback, isLoading: feedbackLoading } = useQuery({
    queryKey: ['feedback', 'am', session.userId],
    queryFn: () => dp.listFeedback(scope),
  })

  const clientList: Client[] = useMemo(() => clients ?? [], [clients])
  const clientsMap = Object.fromEntries(clientList.map((c) => [c.id, c]))
  const myClientIds = useMemo(() => new Set(clientList.map((c) => c.id)), [clientList])
  const productsMap = Object.fromEntries((products ?? []).map((p: Product) => [p.id, p.name]))

  const projects = useMemo(() => allProjects ?? [], [allProjects])
  const activeProjects = projects.filter((p: Project) => !['completed', 'cancelled'].includes(p.status))

  const engagementList: Engagement[] = useMemo(() => engagements ?? [], [engagements])

  const licenseRows = useMemo(() => {
    return (licenses ?? [])
      .filter((l: ProductLicense) => myClientIds.has(l.client_id))
      .flatMap((l: ProductLicense) => [
        { kind: 'License' as const, expires_at: l.license_expires_at, client_id: l.client_id, product_id: l.product_id },
        { kind: 'SLA' as const, expires_at: l.sla_expires_at, client_id: l.client_id, product_id: l.product_id },
      ])
      .map((r) => ({ ...r, days: Math.floor((new Date(r.expires_at).getTime() - nowMs) / DAY_MS) }))
      .sort((a, b) => a.days - b.days)
  }, [licenses, myClientIds, nowMs])
  const expiringSoon = licenseRows.filter((r) => r.days >= 0 && r.days <= EXPIRY_SOON_DAYS)
  const expired = licenseRows.filter((r) => r.days < 0)

  const solutionsMap = Object.fromEntries((solutions ?? []).map((s: Solution) => [s.id, s.name]))
  const queuingCases = useMemo(
    () => (casesData?.items ?? []).filter((c: Case) => !c.assignee_id && ACTIVE_STATUSES.has(c.status)),
    [casesData]
  )
  const closureRejectedCases = useMemo(
    () => (casesData?.items ?? []).filter((c: Case) => !!c.closure_rejected),
    [casesData]
  )

  // listFeedback isn't scoped server-side (only 'client' role is) — scope here.
  const feedbackList: Feedback[] = useMemo(
    () => (feedback ?? []).filter((f: Feedback) => myClientIds.has(f.client_id)),
    [feedback, myClientIds]
  )
  const feedbackRatings = feedbackList.map((f) => f.rating).filter((r): r is number => r != null)
  const avgFeedbackRating = feedbackRatings.length > 0
    ? feedbackRatings.reduce((a, b) => a + b, 0) / feedbackRatings.length
    : null
  const recentFeedback = useMemo(
    () => [...feedbackList].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5),
    [feedbackList]
  )

  if (error) return <ErrorState onRetry={refetch} />

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1680px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Account Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your clients, orders, and license health at a glance</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/clients')}>
          <Building2 className="h-4 w-4" />
          View Clients
        </Button>
      </div>

      {/* KPI strip — one card per sidebar section */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard title="Total Clients" value={clientList.length} icon={Building2} loading={clientsLoading} />
        <StatCard title="Active Projects" value={activeProjects.length} icon={FolderKanban} iconColor="text-blue-500" loading={projectsLoading} />
        <StatCard title="Orders" value={engagementList.length} icon={Handshake} iconColor="text-violet-500" loading={engagementsLoading} />
        <StatCard title="Queuing Cases" value={queuingCases.length} icon={Ticket} iconColor="text-sky-500" loading={casesLoading} />
        <StatCard title="Closure Rejected" value={closureRejectedCases.length} icon={XCircle} iconColor="text-rose-500" loading={casesLoading} />
        <StatCard
          title="Client Feedback"
          value={avgFeedbackRating != null ? `${avgFeedbackRating.toFixed(1)} / 5` : '—'}
          subtitle={`${feedbackList.length} review${feedbackList.length !== 1 ? 's' : ''}`}
          icon={Star}
          iconColor="text-yellow-500"
          loading={feedbackLoading}
        />
        <StatCard title="Expiring Soon" value={expiringSoon.length} subtitle={`within ${EXPIRY_SOON_DAYS} days`} icon={BadgeAlert} iconColor="text-amber-500" loading={licensesLoading} />
        <StatCard title="Expired" value={expired.length} icon={AlertTriangle} iconColor="text-red-500" loading={licensesLoading} />
      </div>

      {/* Main layout: content (left) + license/SLA rail (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        {/* Left column */}
        <div className="space-y-6 min-w-0">
          {/* Queuing cases — view only, no assign action for this role */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Queuing Cases</h2>
              <span className="text-xs text-muted-foreground">{queuingCases.length} unassigned</span>
            </div>
            <div className="space-y-2.5">
              {casesLoading ? (
                <div className="space-y-2.5">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
              ) : queuingCases.length === 0 ? (
                <EmptyState icon={Ticket} title="No queuing cases" description="Unassigned cases for your clients will appear here." />
              ) : (
                queuingCases.map((c: Case) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => router.push(`/cases/${c.id}`)}
                    className="w-full flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left hover:border-primary/40 hover:shadow-md transition-all"
                  >
                    <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
                      <Ticket className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        <span className="font-mono">{c.reference_no}</span>
                        {' · '}{clientsMap[c.client_id]?.company_name ?? '—'}
                        {' · '}{solutionsMap[c.solution_id] ?? '—'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Closure rejected — client bounced the resolution back */}
          {closureRejectedCases.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold">Closure Rejected</h2>
                <span className="text-xs text-muted-foreground">{closureRejectedCases.length} case{closureRejectedCases.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2.5">
                {closureRejectedCases.map((c: Case) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => router.push(`/cases/${c.id}`)}
                    className="w-full flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left hover:border-rose-400/50 hover:shadow-md transition-all"
                  >
                    <div className="rounded-xl bg-rose-500/10 p-2.5 shrink-0">
                      <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        <span className="font-mono">{c.reference_no}</span>
                        {' · '}{clientsMap[c.client_id]?.company_name ?? '—'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right column: client feedback + license/SLA health */}
        <div className="space-y-6 xl:sticky xl:top-6">
          {/* Client feedback — view only */}
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between px-4 py-3.5 border-b">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Star className="h-4 w-4 text-muted-foreground" />
                Client Feedback
              </h3>
            </div>
            <div className="p-3 space-y-1.5">
              {feedbackLoading ? (
                <div className="space-y-1.5 p-1">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
              ) : recentFeedback.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No feedback yet.</p>
              ) : (
                recentFeedback.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => router.push(`/cases/${f.case_id}`)}
                    className="w-full rounded-lg px-2 py-2 text-left hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-foreground truncate">
                        {clientsMap[f.client_id]?.company_name ?? '—'}
                      </span>
                      <div className="flex gap-0.5 shrink-0">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={cn('h-3 w-3', f.rating && n <= f.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{f.feedback_text}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* License & SLA health */}
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between px-4 py-3.5 border-b">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ShieldX className="h-4 w-4 text-muted-foreground" />
                License &amp; SLA Health
              </h3>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-primary" onClick={() => router.push('/license-sla')}>
                View all
              </Button>
            </div>
            <div className="p-3 space-y-1.5">
              {licensesLoading ? (
                <div className="space-y-1.5 p-1">{[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}</div>
              ) : expiringSoon.length === 0 && expired.length === 0 ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> All licenses healthy
                </p>
              ) : (
                [...expired, ...expiringSoon].slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-accent/30 transition-colors">
                    <span className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                      r.days < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                    )}>
                      {r.kind}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{productsMap[r.product_id] ?? r.product_id}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{clientsMap[r.client_id]?.company_name ?? '—'}</p>
                    </div>
                    <span className={cn('text-[11px] font-semibold shrink-0', r.days < 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>
                      {r.days < 0 ? `${-r.days}d ago` : `${r.days}d left`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
