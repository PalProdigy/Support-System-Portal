'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AssignDialog } from './assign-dialog'
import { cn, slaRemainingMs, formatDuration, PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'
import { UserCheck, AlertTriangle, ExternalLink, Clock } from 'lucide-react'
import type { Case, User, CaseStatus } from '@/types'

const ACTIVE_STATUSES: CaseStatus[] = ['new', 'triaged', 'assigned', 'in_progress', 'pending_client', 'escalated']

const COLUMN_COLORS: Partial<Record<CaseStatus, string>> = {
  new: 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700',
  triaged: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800',
  assigned: 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800',
  in_progress: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
  pending_client: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
  escalated: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
}

interface Props {
  cases: Case[]
  engineers: User[]
  usersMap: Record<string, User>
  clientsMap: Record<string, string>
  onEscalate: (c: Case) => void
}

export function QueueKanban({ cases, engineers, usersMap, clientsMap, onEscalate }: Props) {
  const router = useRouter()
  const [assigning, setAssigning] = useState<Case | null>(null)

  const grouped = useMemo(() => {
    const map = new Map<CaseStatus, Case[]>()
    ACTIVE_STATUSES.forEach((s) => map.set(s, []))
    cases
      .filter((c) => ACTIVE_STATUSES.includes(c.status))
      .forEach((c) => map.get(c.status)?.push(c))
    return map
  }, [cases])

  const closedCount = cases.filter((c) => ['resolved', 'pending_closure', 'closed'].includes(c.status)).length

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="inline-flex gap-3 pb-2 min-w-full">
          {ACTIVE_STATUSES.map((status) => {
            const items = grouped.get(status) ?? []
            return (
              <div key={status} className={cn('rounded-xl border flex-shrink-0 w-64 p-3 space-y-2', COLUMN_COLORS[status])}>
                <div className="flex items-center justify-between">
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLORS[status])}>
                    {STATUS_LABELS[status]}
                  </span>
                  <Badge variant="secondary" className="text-[10px] h-4">{items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4 italic">Empty</p>
                  )}
                  {items.map((c) => {
                    const remaining = slaRemainingMs(c.sla_due_at)
                    const breached = remaining < 0
                    const assignee = c.assignee_id ? usersMap[c.assignee_id] : null

                    return (
                      <div key={c.id} className={cn('rounded-lg border bg-card p-3 shadow-sm space-y-2', c.is_escalated && 'border-red-300 dark:border-red-700')}>
                        {/* Ref + priority */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] text-muted-foreground">{c.reference_no}</span>
                          <span className={cn('text-[10px] font-medium px-1 py-0.5 rounded', PRIORITY_COLORS[c.priority])}>
                            {PRIORITY_LABELS[c.priority]}
                          </span>
                        </div>
                        {/* Title */}
                        <p className="text-xs font-semibold line-clamp-2 text-foreground">{c.title}</p>
                        {/* Client */}
                        <p className="text-[10px] text-muted-foreground">{clientsMap[c.client_id] ?? '—'}</p>
                        {/* Assignee */}
                        <p className="text-[10px] text-muted-foreground">
                          {assignee ? <span className="text-foreground font-medium">{assignee.name}</span> : <span className="italic">Unassigned</span>}
                        </p>
                        {/* SLA */}
                        <div className={cn('flex items-center gap-1 text-[10px] font-medium', breached ? 'text-red-600 dark:text-red-400' : remaining < 4 * 3600 * 1000 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                          <Clock className="h-2.5 w-2.5" />
                          {breached ? `Overdue ${formatDuration(Math.abs(remaining))}` : formatDuration(remaining)}
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 pt-0.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="View" onClick={() => router.push(`/cases/${c.id}`)}>
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" title="Assign" onClick={() => setAssigning(c)}>
                            <UserCheck className="h-3 w-3" />
                          </Button>
                          {!c.is_escalated && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-600 hover:text-amber-700 ml-auto" title="Escalate" onClick={() => onEscalate(c)}>
                              <AlertTriangle className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {closedCount > 0 && (
        <p className="text-xs text-muted-foreground">{closedCount} resolved/closed case{closedCount !== 1 ? 's' : ''} not shown</p>
      )}

      <AssignDialog open={!!assigning} onOpenChange={(o) => !o && setAssigning(null)} caseData={assigning} engineers={engineers} />
    </div>
  )
}
