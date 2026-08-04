'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { toast } from '@/hooks/use-toast'
import { Ticket, RotateCcw, Activity, AlertTriangle, ShieldAlert, Check } from 'lucide-react'
import { STATUS_LABELS, PRIORITY_LABELS, slaRemainingMs, slaPercent } from '@/lib/utils'
import type { Case, Client, User, CaseStatus, Priority } from '@/types'

const ACTIVE_STATUSES = new Set(['new', 'triaged', 'assigned', 'in_progress', 'pending_client', 'escalated'])

/**
 * "My Cases" — the support engineer's full case workspace. Merges what used
 * to be split across /cases (search, filters, KPI overview, pagination) and
 * the Engineer Hub's assigned-cases list into one organized view, scoped to
 * this engineer's own cases (listCases already does that scoping for the
 * support_engineer role).
 */
export function MyCases() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const scope = { userId: session.userId, role: session.role }

  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [status, setStatus] = useState<string>('all')
  const [priority, setPriority] = useState<string>('all')
  const [slaFilter, setSLAFilter] = useState<string>(searchParams.get('sla') ?? 'all')
  const [page, setPage] = useState(1)

  // Sync search state when the URL ?search param changes (e.g. from topbar)
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
    queryKey: ['clients-all', session.userId],
    queryFn: () => dp.listClients({ userId: session.userId, role: 'team_lead' }),
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

  // Still-unassigned cases routed to my team — shown inline at the top of the
  // Active bucket below (with a Grab action instead of an assignee) rather
  // than as a separate section. Grabbing assigns directly, no approval needed.
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

  const clientsMap = Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c]))
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))

  const allCases = statsData?.items ?? []
  const totalCount = statsData?.total ?? 0
  const activeCount = allCases.filter((c) => ACTIVE_STATUSES.has(c.status)).length
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
  // Claimable cases aren't mine yet, so they only make sense in the default
  // grouped view (no active search/status/SLA filter) — prepended to Active.
  const claimableCases = showGrouped ? (claimable ?? []) : []
  const activeCases = [...claimableCases, ...cases.filter((c) => ACTIVE_STATUSES.has(c.status))]
  const previousCases = cases.filter((c) => !ACTIVE_STATUSES.has(c.status))
  const hasFilters = search || status !== 'all' || priority !== 'all' || slaFilter !== 'all'
  const claimableIds = new Set(claimableCases.map((c) => c.id))

  const grabButton = (c: Case) => (
    <Button
      size="sm"
      className="bg-emerald-600 hover:bg-emerald-700 text-white"
      disabled={claimCase.isPending}
      onClick={() => claimCase.mutate(c.id)}
    >
      <Check className="h-3.5 w-3.5" /> Grab Case
    </Button>
  )

  if (error) return <ErrorState onRetry={refetch} />

  return (
    <div className="space-y-4">
      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Total Cases" value={totalCount} icon={Ticket} loading={statsLoading} />
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
          minChars={2}
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
          title={search ? `No results found for "${search}"` : 'No cases assigned to you'}
          description={hasFilters ? 'Try adjusting your filters.' : 'Cases assigned to you will appear here.'}
        />
      ) : showGrouped ? (
        <div className="space-y-5">
          {activeCases.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-green-600">
                Active <span className="font-normal">· {activeCases.length}</span>
              </p>
              {activeCases.map((c: Case) => (
                <CaseCard
                  key={c.id}
                  case_={c}
                  client={clientsMap[c.client_id]}
                  assignee={c.assignee_id ? usersMap[c.assignee_id] : undefined}
                  href={`/my-case/${c.id}`}
                  action={claimableIds.has(c.id) ? grabButton(c) : undefined}
                />
              ))}
            </div>
          )}
          {previousCases.length > 0 && (
            <div className="space-y-3">
              {activeCases.length > 0 && <hr className="border-border" />}
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                Closed / Resolved <span className="font-normal">· {previousCases.length}</span>
              </p>
              {previousCases.map((c: Case) => (
                <CaseCard key={c.id} case_={c} client={clientsMap[c.client_id]} assignee={c.assignee_id ? usersMap[c.assignee_id] : undefined} href={`/my-case/${c.id}`} />
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
              href={`/my-case/${c.id}`}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
