'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { CaseCard } from '@/components/shared/case-card'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { PlusCircle, Search, Ticket } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Case, Client, User } from '@/types'
import { STATUS_LABELS, PRIORITY_LABELS } from '@/lib/utils'
import type { CaseStatus, Priority } from '@/types'

export default function CasesPage() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const searchParams = useSearchParams()
  const scope = { userId: session.userId, role: session.role }

  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [status, setStatus] = useState<string>('all')
  const [priority, setPriority] = useState<string>('all')
  const [page, setPage] = useState(1)

  // Sync search state when URL ?search param changes (e.g. from topbar)
  useEffect(() => {
    const q = searchParams.get('search') ?? ''
    setSearch(q)
    setPage(1)
  }, [searchParams])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cases', scope, search, status, priority, page],
    queryFn: () =>
      dp.listCases(scope, {
        search: search || undefined,
        status: status === 'all' ? undefined : status,
        priority: priority === 'all' ? undefined : priority,
        page,
        pageSize: 15,
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

  const clientsMap = Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c]))
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))

  const cases = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 15)

  const ACTIVE_STATUSES = new Set(['new', 'triaged', 'assigned', 'in_progress', 'pending_client', 'escalated'])
  const showGrouped = status === 'all' && !search
  const activeCases = cases.filter(c => ACTIVE_STATUSES.has(c.status))
  const previousCases = cases.filter(c => !ACTIVE_STATUSES.has(c.status))

  if (error) return (
    <div className="p-6"><ErrorState onRetry={refetch} /></div>
  )

  const canCreate = ['client', 'technical_head'].includes(session.role)

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cases</h1>
          <p className="text-sm text-muted-foreground">
            {session.role === 'module_lead' && 'Your team · '}
            {session.role === 'support_engineer' && 'Assigned to you · '}
            {session.role === 'technical_head' && 'All cases · '}
            {session.role === 'client' && 'Your cases · '}
            {session.role === 'account_manager' && "Your clients' cases · "}
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

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or reference..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
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
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : cases.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No cases found"
          description={search || status !== 'all' ? 'Try adjusting your filters.' : 'No cases yet.'}
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