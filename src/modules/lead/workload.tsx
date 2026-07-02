'use client'

import { useMemo } from 'react'
import { cn, slaPercent } from '@/lib/utils'
import { Users, Ticket, AlertTriangle } from 'lucide-react'
import type { Case, User } from '@/types'

interface Props {
  cases: Case[]
  engineers: User[]
}

export function Workload({ cases, engineers }: Props) {
  const rows = useMemo(() => {
    return engineers
      .filter((e) => e.is_active)
      .map((eng) => {
        const all = cases.filter((c) => c.assignee_id === eng.id)
        const open = all.filter((c) => !['closed', 'resolved', 'pending_closure'].includes(c.status))
        const critical = open.filter((c) => c.priority === 'critical').length
        const breached = open.filter((c) => slaPercent(c.created_at, c.sla_due_at) >= 100).length
        const pending = open.filter((c) => c.status === 'pending_client').length
        const inProgress = open.filter((c) => c.status === 'in_progress').length
        return { eng, open: open.length, critical, breached, pending, inProgress, all: all.length }
      })
      .sort((a, b) => b.open - a.open)
  }, [cases, engineers])

  const maxOpen = Math.max(...rows.map((r) => r.open), 1)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>{rows.length} engineer{rows.length !== 1 ? 's' : ''} · {cases.filter((c) => !['closed', 'resolved', 'pending_closure'].includes(c.status)).length} open cases total</span>
      </div>

      <div className="space-y-3">
        {rows.map(({ eng, open, critical, breached, pending, inProgress }) => (
          <div key={eng.id} className="rounded-xl border bg-card p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-sm text-foreground">{eng.name}</p>
                <p className="text-xs text-muted-foreground">{eng.email}</p>
              </div>
              <div className="flex items-center gap-1.5 text-right">
                <Ticket className="h-4 w-4 text-muted-foreground" />
                <span className={cn('text-lg font-bold', open > 5 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>{open}</span>
                <span className="text-xs text-muted-foreground">open</span>
              </div>
            </div>

            {/* Load bar */}
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', open === 0 ? 'bg-emerald-400' : open > 5 ? 'bg-red-500' : open > 2 ? 'bg-amber-500' : 'bg-primary')}
                style={{ width: `${Math.round((open / maxOpen) * 100)}%` }}
              />
            </div>

            {/* Breakdown chips */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                {inProgress} in progress
              </span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {pending} awaiting client
              </span>
              {critical > 0 && (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
                  <AlertTriangle className="h-3 w-3" />
                  {critical} critical
                </span>
              )}
              {breached > 0 && (
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {breached} SLA breach{breached > 1 ? 'es' : ''}
                </span>
              )}
              {open === 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Available</span>
              )}
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No engineers in this team.</p>
        )}
      </div>
    </div>
  )
}