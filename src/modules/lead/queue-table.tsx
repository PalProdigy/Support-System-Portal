'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { AssignDialog } from './assign-dialog'
import {
  cn, formatDate, slaRemainingMs, formatDuration,
  PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS,
} from '@/lib/utils'
import { Search, ArrowUpDown, UserCheck, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react'
import type { Case, User } from '@/types'
import type { CaseStatus, Priority } from '@/types'

type SortKey = 'reference_no' | 'priority' | 'sla_due_at' | 'status' | 'created_at'
type SortDir = 'asc' | 'desc'

const PRIORITY_ORDER: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 }

interface Props {
  cases: Case[]
  engineers: User[]
  usersMap: Record<string, User>
  clientsMap: Record<string, string>
  onEscalate: (c: Case) => void
}

export function QueueTable({ cases, engineers, usersMap, clientsMap, onEscalate }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('sla_due_at')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [assigning, setAssigning] = useState<Case | null>(null)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function runSearch() {
    setIsSearching(true)
    setQuery(search)
    setTimeout(() => setIsSearching(false), 300)
  }

  const filtered = useMemo(() => {
    let list = [...cases]
    if (statusFilter !== 'all') list = list.filter((c) => c.status === statusFilter)
    if (priorityFilter !== 'all') list = list.filter((c) => c.priority === priorityFilter)
    if (assigneeFilter !== 'all') {
      if (assigneeFilter === 'unassigned') list = list.filter((c) => !c.assignee_id)
      else list = list.filter((c) => c.assignee_id === assigneeFilter)
    }
    if (query) {
      const q = query.toLowerCase()
      list = list.filter((c) => c.title.toLowerCase().includes(q) || c.reference_no.toLowerCase().includes(q))
    }
    list.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'reference_no') cmp = a.reference_no.localeCompare(b.reference_no)
      else if (sortKey === 'priority') cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      else if (sortKey === 'sla_due_at') cmp = new Date(a.sla_due_at).getTime() - new Date(b.sla_due_at).getTime()
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
      else if (sortKey === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [cases, statusFilter, priorityFilter, assigneeFilter, query, sortKey, sortDir])

  function Th({ label, sk }: { label: string; sk: SortKey }) {
    const active = sortKey === sk
    return (
      <th
        className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors"
        onClick={() => toggleSort(sk)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <ArrowUpDown className={cn('h-3 w-3', active ? 'text-primary' : 'opacity-30')} />
        </span>
      </th>
    )
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-9 h-8 text-sm"
            placeholder="Search ref# or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
          />
        </div>
        <Button size="sm" className="h-8" onClick={runSearch} disabled={isSearching} aria-label="Search">
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4" />Search</>}
        </Button>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CaseStatus | 'all')}>
          <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(STATUS_LABELS) as CaseStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as Priority | 'all')}>
          <SelectTrigger className="h-8 w-32 text-sm"><SelectValue placeholder="All priorities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {(['critical', 'high', 'medium', 'low'] as Priority[]).map((p) => (
              <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="All engineers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All engineers</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {engineers.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} case{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-muted/40 border-b">
            <tr>
              <Th label="Ref #" sk="reference_no" />
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Title</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Client</th>
              <Th label="Priority" sk="priority" />
              <Th label="Status" sk="status" />
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Assignee</th>
              <Th label="SLA Due" sk="sla_due_at" />
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">No matching cases</td></tr>
            )}
            {filtered.map((c) => {
              const remaining = slaRemainingMs(c.sla_due_at)
              const breached = remaining < 0
              const active = !['closed', 'resolved', 'pending_closure'].includes(c.status)
              const assignee = c.assignee_id ? usersMap[c.assignee_id] : null

              return (
                <tr
                  key={c.id}
                  className={cn(
                    'hover:bg-muted/30 transition-colors',
                    c.is_escalated && 'bg-red-50/30 dark:bg-red-950/10',
                  )}
                >
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs text-muted-foreground">{c.reference_no}</span>
                  </td>
                  <td className="px-3 py-2.5 max-w-[200px]">
                    <p className="truncate font-medium text-foreground">{c.title}</p>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{clientsMap[c.client_id] ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', PRIORITY_COLORS[c.priority])}>
                      {PRIORITY_LABELS[c.priority]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap', STATUS_COLORS[c.status])}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {assignee ? (
                      <span className="text-foreground">{assignee.name}</span>
                    ) : (
                      <span className="text-muted-foreground italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {active ? (
                      <span className={cn('text-xs font-medium whitespace-nowrap', breached ? 'text-red-600 dark:text-red-400' : remaining < 4 * 3600 * 1000 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                        {breached ? `−${formatDuration(Math.abs(remaining))}` : formatDuration(remaining)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{formatDate(c.sla_due_at)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="View case" onClick={() => router.push(`/cases/${c.id}`)}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      {!['closed', 'resolved', 'pending_closure'].includes(c.status) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" title="Assign / Reassign" onClick={() => setAssigning(c)}>
                          <UserCheck className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {!c.is_escalated && !['closed', 'resolved'].includes(c.status) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700" title="Escalate to TH" onClick={() => onEscalate(c)}>
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <AssignDialog open={!!assigning} onOpenChange={(o) => !o && setAssigning(null)} caseData={assigning} engineers={engineers} />
    </div>
  )
}
