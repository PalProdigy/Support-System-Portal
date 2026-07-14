'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { CaseCard } from '@/components/shared/case-card'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { StatCard } from '@/components/shared/stat-card'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { PlusCircle, Ticket, RotateCcw, Activity, AlertTriangle, ShieldAlert, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Case, Client, User } from '@/types'
import { STATUS_LABELS, PRIORITY_LABELS, slaRemainingMs, slaPercent } from '@/lib/utils'
import type { CaseStatus, Priority } from '@/types'

export default function CasesPage() {
  const session = useSession()
  const router = useRouter()

  // Support engineers get a single, merged case workspace at /my-case
  // ("My Cases") instead of this general Cases list.
  useEffect(() => {
    if (session.role === 'support_engineer') router.replace('/my-case')
  }, [session.role, router])

  if (session.role === 'support_engineer') return null

  return <CasesPageContent />
}

function CasesPageContent() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const searchParams = useSearchParams()
  const scope = { userId: session.userId, role: session.role }

  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [status, setStatus] = useState<string>('all')
  const [priority, setPriority] = useState<string>('all')
  const [slaFilter, setSLAFilter] = useState<string>('all')
  const [page, setPage] = useState(1)

  // Sync search state when URL ?search param changes (e.g. from topbar)
  useEffect(() => {
    const q = searchParams.get('search') ?? ''
    const s = searchParams.get('sla') ?? 'all'
    setSearch(q)
    setSLAFilter(s)
    setPage(1)
  }, [searchParams])

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['cases', scope, search, status, priority, page],
    queryFn: () =>
      dp.listCases(scope, {
        search: search || undefined,
        status: status === 'all' ? undefined : status,
        priority: priority === 'all' ? undefined : priority,
        page,
        pageSize: 15,
        top_level_only: true,
      }),
  })

  const { data: clients } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => dp.listUsers(),
  })

  // Unfiltered snapshot of every case in scope, used for the overview cards
  // above — independent of the current search/filter/pagination state.
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['cases', 'stats', scope],
    queryFn: () => dp.listCases(scope, { pageSize: 1000, top_level_only: true }),
  })

  const clientsMap = Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c]))
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))

  const ACTIVE_STATUSES = new Set(['new', 'triaged', 'assigned', 'in_progress', 'pending_client', 'escalated'])
  const DONE_STATUSES = new Set(['resolved', 'pending_closure', 'closed'])
  const allCases = statsData?.items ?? []
  const totalCount = statsData?.total ?? 0
  const activeCount = allCases.filter((c) => ACTIVE_STATUSES.has(c.status)).length
  const resolvedCount = allCases.filter((c) => DONE_STATUSES.has(c.status)).length
  const escalatedCount = allCases.filter((c) => c.is_escalated || c.status === 'escalated').length
  const reopenedCount = allCases.filter((c) => !!c.reopened_from_case_id).length
  const slaBreachedCount = allCases.filter((c) => slaRemainingMs(c.sla_due_at) <= 0).length

  let cases = data?.items ?? []
  const total = data?.total ?? 0

  // Apply SLA filtering after fetching
  if (slaFilter !== 'all') {
    cases = cases.filter((c: Case) => {
      const remaining = slaRemainingMs(c.sla_due_at)
      const percent = slaPercent(c.created_at, c.sla_due_at)
      if (slaFilter === 'breached') return remaining <= 0
      if (slaFilter === 'at-risk') return remaining > 0 && percent >= 80
      return true
    })
  }

  const totalPages = Math.ceil(total / 15)

  const showGrouped = status === 'all' && !search && slaFilter === 'all'
  const activeCases = cases.filter(c => ACTIVE_STATUSES.has(c.status))
  const previousCases = cases.filter(c => !ACTIVE_STATUSES.has(c.status))

  if (error) return (
    <div className="p-6"><ErrorState onRetry={refetch} /></div>
  )

  const canCreate = ['client', 'technical_head'].includes(session.role)
  const hasFilters = search || status !== 'all' || priority !== 'all' || slaFilter !== 'all'
  // Resolved-count card: a team lead's cases are already scoped to their own team,
  // and a technical head's cases are unscoped (everyone) — both sums are unfiltered totals.
  const showResolvedCard = ['team_lead', 'technical_head'].includes(session.role)

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cases</h1>
          <p className="text-sm text-muted-foreground">
            {session.role === 'team_lead' && 'Your team · '}
            {session.role === 'technical_head' && 'All cases · '}
            {session.role === 'client' && 'Your cases · '}
            {session.role === 'sales_executive' && "Your clients' cases · "}
            {total} total
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => router.push('/cases/new')}>
            <PlusCircle className="h-4 w-4" />
            New Case
          </Button>
        )}
      </div>

      {/* Overview */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-4 ${showResolvedCard ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
        <StatCard title="Total Cases" value={totalCount} icon={Ticket} loading={statsLoading} />
        {showResolvedCard && (
          <StatCard title="Total Resolved" value={resolvedCount} icon={CheckCircle} iconColor="text-emerald-500" loading={statsLoading} />
        )}
        <StatCard title="Active Cases" value={activeCount} icon={Activity} iconColor="text-sky-500" loading={statsLoading} />
        <StatCard title="Escalated" value={escalatedCount} icon={AlertTriangle} iconColor="text-red-500" loading={statsLoading} />
        <StatCard title="Reopened" value={reopenedCount} icon={RotateCcw} iconColor="text-amber-500" loading={statsLoading} />
        <StatCard title="SLA Breached" value={slaBreachedCount} icon={ShieldAlert} iconColor={slaBreachedCount > 0 ? 'text-red-500' : 'text-emerald-500'} loading={statsLoading} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <SearchInput
          containerClassName="flex-1 min-w-48"
          className="h-9"
          placeholder="Search by title or reference..."
          value={search}
          onChange={(v) => { setSearch(v); setPage(1) }}
          debounceMs={350}
          loading={isFetching}
          aria-label="Search cases"
          resultCount={total}
          resultLabel="case"
        />
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(Object.keys(STATUS_LABELS) as CaseStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1) }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
              <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={slaFilter} onValueChange={(v) => { setSLAFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="SLA State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All SLA States</SelectItem>
            <SelectItem value="breached">Breached</SelectItem>
            <SelectItem value="at-risk">At Risk</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatus('all'); setPriority('all'); setSLAFilter('all'); setPage(1) }}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : cases.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={search ? `No results found for "${search}"` : 'No cases found'}
          description={hasFilters ? 'Try adjusting your filters.' : 'No cases yet.'}
        />
      ) : showGrouped ? (
        <div className="space-y-5">
          {activeCases.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider  text-green-600">
                Active <span className="font-normal">· {activeCases.length}</span>
              </p>
              {activeCases.map((c: Case) => (
                <CaseCard key={c.id} case_={c} client={clientsMap[c.client_id]} assignee={c.assignee_id ? usersMap[c.assignee_id] : undefined} href={`/cases/${c.id}`} />
              ))}
            </div>
          )}
          {previousCases.length > 0 && (
            <div className="space-y-3">
              {activeCases.length > 0 && <hr className="border-border" />}
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 ">
                Closed / Resolved <span className="font-normal">· {previousCases.length}</span>
              </p>
              {previousCases.map((c: Case) => (
                <CaseCard key={c.id} case_={c} client={clientsMap[c.client_id]} assignee={c.assignee_id ? usersMap[c.assignee_id] : undefined} href={`/cases/${c.id}`} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map((c: Case) => (
            <CaseCard
              key={c.id}
              case_={c}
              client={clientsMap[c.client_id]}
              assignee={c.assignee_id ? usersMap[c.assignee_id] : undefined}
              href={`/cases/${c.id}`}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}