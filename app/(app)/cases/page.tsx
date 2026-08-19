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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SearchInput } from '@/components/ui/search-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/shared/searchable-select'
import { Skeleton } from '@/components/ui/skeleton'
import { AssignDialog } from '@/modules/lead/assign-dialog'
import { NewCaseDialog } from '@/modules/cases/new-case-dialog'
import { PlusCircle, Ticket, RotateCcw, Activity, AlertTriangle, CheckCircle, User as UserIcon, CalendarDays, UserCheck, SlidersHorizontal } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Case, Client, User } from '@/types'
import { cn, STATUS_LABELS, PRIORITY_LABELS, matchesQuickFilter, QUICK_FILTER_LONG_QUEUE_MS, QUICK_FILTER_LONG_RUNNING_MS } from '@/lib/utils'
import type { CaseQuickFilter } from '@/lib/utils'
import type { CaseStatus, Priority } from '@/types'
import { canAccess } from '@/lib/rbac'

const QUICK_FILTER_LABELS: Record<CaseQuickFilter, string> = {
  escalated: 'Escalated',
  reopened: 'Reopened',
  closure_rejected: 'Closure Rejected',
  long_queue: 'Long Queuing (unassigned > 24h)',
  long_running: '3+ Months Running Cases',
}

function isQuickFilter(v: string | null): v is CaseQuickFilter {
  return v != null && v in QUICK_FILTER_LABELS
}

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
  const [queueFilter, setQueueFilter] = useState<string>('all')
  const [engineerFilter, setEngineerFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [assignTarget, setAssignTarget] = useState<Case | null>(null)
  const [newCaseOpen, setNewCaseOpen] = useState(false)
  // Deep-linked from dashboard watchlists, e.g. /cases?quick=escalated.
  const quickParam = searchParams.get('quick')
  const quickFilter = isQuickFilter(quickParam) ? quickParam : null
  // Stable per navigation so age-based buckets (long_queue/long_running) don't
  // shift while the page is open.
  const [nowMs] = useState(() => Date.now())

  // Sync search state when URL ?search param changes (e.g. from topbar)
  useEffect(() => {
    const q = searchParams.get('search') ?? ''
    setSearch(q)
    setPage(1)
  }, [searchParams])

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['cases', scope, search, status, priority, engineerFilter, dateFrom, dateTo, page],
    queryFn: () =>
      dp.listCases(scope, {
        search: search || undefined,
        status: status === 'all' ? undefined : status,
        priority: priority === 'all' ? undefined : priority,
        assignee_id: engineerFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
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
  const engineers = (users ?? []).filter((u: User) => ['support_engineer', 'team_lead'].includes(u.role) && u.is_active)
  const canAssign = canAccess(scope, 'assign', 'case')

  const assignAction = (c: Case) =>
    canAssign && !c.assignee_id ? (
      <Button size="sm" variant="outline" onClick={() => setAssignTarget(c)}>
        <UserCheck className="h-3.5 w-3.5" /> Assign
      </Button>
    ) : undefined

  const ACTIVE_STATUSES = new Set(['new', 'triaged', 'assigned', 'in_progress', 'pending_client', 'escalated'])
  const DONE_STATUSES = new Set(['resolved', 'pending_closure', 'closed'])
  const allCases = statsData?.items ?? []
  const totalCount = statsData?.total ?? 0
  const activeCount = allCases.filter((c) => ACTIVE_STATUSES.has(c.status)).length
  const resolvedCount = allCases.filter((c) => DONE_STATUSES.has(c.status)).length
  const escalatedCount = allCases.filter((c) => c.is_escalated || c.status === 'escalated').length
  const reopenedCount = allCases.filter((c) => !!c.reopened_from_case_id).length
  let cases = data?.items ?? []
  let total = data?.total ?? 0

  // A quick-filter deep link takes over entirely: source from the unpaginated
  // `allCases` snapshot and ignore search/status/priority/sla so the bucket's
  // full membership is shown (buckets are small — no pagination needed).
  if (quickFilter) {
    cases = allCases.filter((c: Case) => matchesQuickFilter(c, quickFilter, nowMs))
    total = cases.length
  } else if (queueFilter !== 'all') {
    cases = cases.filter((c: Case) => {
      const isOpen = ACTIVE_STATUSES.has(c.status)
      switch (queueFilter) {
        case 'long_queue':
          return isOpen && !c.assignee_id && nowMs - new Date(c.created_at).getTime() > QUICK_FILTER_LONG_QUEUE_MS
        case 'long_running':
          return isOpen && nowMs - new Date(c.created_at).getTime() > QUICK_FILTER_LONG_RUNNING_MS
        default:
          return true
      }
    })
  }

  const totalPages = quickFilter ? 1 : Math.ceil(total / 15)

  const showGrouped = !quickFilter && status === 'all' && !search && queueFilter === 'all'
  const activeCases = cases.filter(c => ACTIVE_STATUSES.has(c.status))
  const previousCases = cases.filter(c => !ACTIVE_STATUSES.has(c.status))

  if (error) return (
    <div className="p-6"><ErrorState onRetry={refetch} /></div>
  )

  const canCreate = ['client', 'technical_head', 'team_lead'].includes(session.role)
  const hasFilters = !!quickFilter || search || status !== 'all' || priority !== 'all' || queueFilter !== 'all' || !!engineerFilter || !!dateFrom || !!dateTo
  const activeFilterCount = [status !== 'all', priority !== 'all', queueFilter !== 'all', !!engineerFilter, !!(dateFrom || dateTo)].filter(Boolean).length
  const clearFilters = () => {
    setSearch(''); setStatus('all'); setPriority('all'); setQueueFilter('all')
    setEngineerFilter(''); setDateFrom(''); setDateTo('')
    setPage(1)
    router.replace('/cases', { scroll: false })
  }
  // Resolved-count card: a team lead's cases are already scoped to their own team,
  // and a technical head's cases are unscoped (everyone) — both sums are unfiltered totals.
  const showResolvedCard = ['team_lead', 'technical_head'].includes(session.role)

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cases</h1>

        </div>
        {canCreate && (
          <Button onClick={() => setNewCaseOpen(true)}>
            <PlusCircle className="h-4 w-4" /> New Case
          </Button>
        )}
      </div>

      <NewCaseDialog open={newCaseOpen} onOpenChange={setNewCaseOpen} />

      {/* Overview */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-4 ${showResolvedCard ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        <StatCard title="Total Cases" value={totalCount} icon={Ticket} loading={statsLoading} />
        {showResolvedCard && (
          <StatCard title="Total Resolved" value={resolvedCount} icon={CheckCircle} iconColor="text-emerald-500" loading={statsLoading} />
        )}
        <StatCard title="Active Cases" value={activeCount} icon={Activity} iconColor="text-sky-500" loading={statsLoading} />
        <StatCard title="Escalated" value={escalatedCount} icon={AlertTriangle} iconColor="text-red-500" loading={statsLoading} />
        <StatCard title="Reopened" value={reopenedCount} icon={RotateCcw} iconColor="text-amber-500" loading={statsLoading} />
      </div>

      {/* Quick-filter banner (deep-linked from a dashboard watchlist) — replaces
          the normal filter controls so the bucket's membership stays exact. */}
      {quickFilter ? (
        <div className="flex items-center gap-2 flex-wrap rounded-lg border bg-accent/20 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-sm text-foreground">
            Filtered: <span className="font-semibold">{QUICK_FILTER_LABELS[quickFilter]}</span>
          </span>
          <span className="text-xs text-muted-foreground">{cases.length} case{cases.length !== 1 ? 's' : ''}</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={clearFilters}>
            <RotateCcw className="h-4 w-4" />
            Clear filter
          </Button>
        </div>
      ) : (
        <div className="flex   items-center gap-2.5">
          <SearchInput
            containerClassName="min-w-0 flex-1 lg:min-w-[220px]"
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

          {/* Mobile — all filter options collapsed into one "Filters" popover,
              same pattern as the audit-log page's mobile filter button. */}
          <div className="lg:hidden">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('shrink-0', activeFilterCount > 0 && 'border-primary/50 text-primary')}>
                  <SlidersHorizontal className="h-4 w-4" /> Filters
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 text-xs font-semibold">{activeFilterCount}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-72 max-h-[min(70vh,var(--radix-popover-content-available-height,70vh))] overflow-y-auto space-y-3 px-3 py-3"
                align="end"
                collisionPadding={8}
              >
                <div className="flex items-center justify-between p-2">
                  <p className="text-sm font-semibold">Filter cases</p>
                  {(activeFilterCount > 0 || !!quickFilter) && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={clearFilters}>
                      <RotateCcw className="h-3 w-3" /> Clear
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {(Object.keys(STATUS_LABELS) as CaseStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Priority</Label>
                  <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1) }}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                        <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Queue state</Label>
                  <Select value={queueFilter} onValueChange={(v) => { setQueueFilter(v); setPage(1) }}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Queue State" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cases</SelectItem>
                      <SelectItem value="long_queue">Long Queuing (&gt; 24h)</SelectItem>
                      <SelectItem value="long_running">3+ Months Running</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Engineer</Label>
                  <SearchableSelect
                    icon={UserIcon}
                    options={engineers.map((u: User) => ({ id: u.id, label: u.name, sublabel: u.role === 'team_lead' ? 'Team Lead' : 'Engineer' }))}
                    value={engineerFilter}
                    onChange={(v) => { setEngineerFilter(v); setPage(1) }}
                    placeholder="All Engineers"
                    searchPlaceholder="Search engineers..."
                    triggerClassName="h-8 rounded-md text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input type="date" className="h-8" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input type="date" className="h-8" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} />
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Desktop — individual filters laid out inline in one row (unchanged) */}
          <div className="hidden lg:flex lg:flex-wrap lg:items-center gap-2.5">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
              <SelectTrigger className="h-9 w-36">
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
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={queueFilter} onValueChange={(v) => { setQueueFilter(v); setPage(1) }}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue placeholder="Queue State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cases</SelectItem>
                <SelectItem value="long_queue">Long Queuing (&gt; 24h)</SelectItem>
                <SelectItem value="long_running">3+ Months Running</SelectItem>
              </SelectContent>
            </Select>
            <SearchableSelect
              icon={UserIcon}
              options={engineers.map((u: User) => ({ id: u.id, label: u.name, sublabel: u.role === 'team_lead' ? 'Team Lead' : 'Engineer' }))}
              value={engineerFilter}
              onChange={(v) => { setEngineerFilter(v); setPage(1) }}
              placeholder="All Engineers"
              searchPlaceholder="Search engineers..."
              triggerClassName="h-9 rounded-md w-48"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 w-48">
                  <CalendarDays className="h-4 w-4" />
                  {dateFrom || dateTo ? `${dateFrom || '…'} – ${dateTo || '…'}` : 'Date Range'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 space-y-3" align="start">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">From</Label>
                  <Input type="date" className="h-9" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">To</Label>
                  <Input type="date" className="h-9" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} />
                </div>
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }}>
                    Clear dates
                  </Button>
                )}
              </PopoverContent>
            </Popover>
            {hasFilters && (
              <Button variant="outline" className="h-9" onClick={clearFilters}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      {(quickFilter ? statsLoading : isLoading) ? (
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
                <CaseCard key={c.id} case_={c} client={clientsMap[c.client_id]} assignee={c.assignee_id ? usersMap[c.assignee_id] : undefined} unassigned={!c.assignee_id} href={`/cases/${c.id}`} action={assignAction(c)} />
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
                <CaseCard key={c.id} case_={c} client={clientsMap[c.client_id]} assignee={c.assignee_id ? usersMap[c.assignee_id] : undefined} unassigned={!c.assignee_id} href={`/cases/${c.id}`} action={assignAction(c)} />
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
              unassigned={!c.assignee_id}
              href={`/cases/${c.id}`}
              action={assignAction(c)}
            />
          ))}
        </div>
      )}

      <AssignDialog
        open={!!assignTarget}
        onOpenChange={(o) => { if (!o) setAssignTarget(null) }}
        caseData={assignTarget}
        engineers={engineers}
      />

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