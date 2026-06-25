'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { EmptyState } from '@/components/shared/empty-state'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Ticket, Search, Clock } from 'lucide-react'
import { cn, slaRemainingMs, formatDuration, formatDate, PRIORITY_COLORS, PRIORITY_LABELS, CLIENT_STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'
import type { CaseStatus, Priority } from '@/types'

const ALL = 'all'

export function MyCases() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>(ALL)
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>(ALL)

  const { data: casesPage, isLoading } = useQuery({
    queryKey: ['cases', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 100 }),
  })

  const { data: solutions } = useQuery({
    queryKey: ['solutions'],
    queryFn: () => dp.listSolutions(),
  })

  const solutionsMap = Object.fromEntries((solutions ?? []).map((s) => [s.id, s.name]))

  const cases = (casesPage?.items ?? []).filter((c) => {
    if (statusFilter !== ALL && c.status !== statusFilter) return false
    if (priorityFilter !== ALL && c.priority !== priorityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return c.title.toLowerCase().includes(q) || c.reference_no.toLowerCase().includes(q)
    }
    return true
  })

  if (isLoading) return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-9 h-8 text-sm" placeholder="Search cases…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CaseStatus | 'all')}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {(Object.keys(CLIENT_STATUS_LABELS) as CaseStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{CLIENT_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as Priority | 'all')}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All priorities</SelectItem>
            {(['low', 'medium', 'high', 'critical'] as Priority[]).map((p) => (
              <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {cases.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={search || statusFilter !== ALL || priorityFilter !== ALL ? 'No matching cases' : 'No cases yet'}
          description={search || statusFilter !== ALL || priorityFilter !== ALL ? 'Try adjusting your filters.' : 'Submit a case from the My Portal page to get started.'}
        />
      ) : (
        <div className="space-y-2">
          {cases.map((c) => {
            const remaining = slaRemainingMs(c.sla_due_at)
            const breached = remaining < 0
            const active = !['closed', 'resolved', 'pending_closure', 'pending_client'].includes(c.status)
            const awaitingMe = c.status === 'pending_client'

            return (
              <div
                key={c.id}
                onClick={() => router.push(`/client/cases/${c.id}`)}
                className={cn(
                  'rounded-xl border bg-card p-4 cursor-pointer hover:bg-accent/30 transition-colors',
                  awaitingMe && 'border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20',
                  breached && active && 'border-red-300 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{c.reference_no}</span>
                      <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', PRIORITY_COLORS[c.priority])}>
                        {PRIORITY_LABELS[c.priority]}
                      </span>
                    </div>
                    <p className="font-medium text-sm text-foreground truncate">{c.title}</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[c.status])}>
                        {CLIENT_STATUS_LABELS[c.status]}
                      </span>
                      {c.solution_id && solutionsMap[c.solution_id] && (
                        <span className="text-xs text-muted-foreground">{solutionsMap[c.solution_id]}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    <p className="text-[10px] text-muted-foreground">{formatDate(c.created_at)}</p>
                    {active && (
                      <div className={cn('flex items-center gap-1 text-xs font-medium', breached ? 'text-red-600 dark:text-red-400' : remaining < 4 * 3600 * 1000 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                        <Clock className="h-3 w-3" />
                        <span>{breached ? `Overdue ${formatDuration(Math.abs(remaining))}` : formatDuration(remaining)}</span>
                      </div>
                    )}
                    {awaitingMe && (
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 block">Reply needed</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}