import Link from 'next/link'
import { PriorityChip } from './priority-chip'
import { StatusBadge } from './status-badge'
import { SLACountdown } from './sla-countdown'
import { formatDateTime } from '@/lib/utils'
import type { Case, Client, User } from '@/types'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CaseCardProps {
  case_: Case
  client?: Client
  assignee?: User
  href?: string
  compact?: boolean
  /** Render an "Unassigned" badge instead of the case status badge. */
  unassigned?: boolean
}

export function CaseCard({ case_, client, assignee, href, compact, unassigned }: CaseCardProps) {
  const content = (
    <div
      className={cn(
        'rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md',
        compact ? 'p-3' : 'p-4'
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground">{case_.reference_no}</span>
          {case_.is_escalated && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" />
              Escalated
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <PriorityChip priority={case_.priority} size="sm" />
          {unassigned ? (
            <span className="inline-flex items-center rounded-md font-medium px-2 py-0.5 text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              Unassigned
            </span>
          ) : (
            <StatusBadge status={case_.status} size="sm" />
          )}
        </div>
      </div>

      {/* Title */}
      <p className={cn('font-medium text-foreground line-clamp-2', compact ? 'text-sm' : 'text-base')}>
        {case_.title}
      </p>

      {/* Meta row */}
      <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {client && <span>{client.company_name}</span>}
          {assignee && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span>{assignee.name}</span>
            </>
          )}
          {!compact && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span>{formatDateTime(case_.created_at)}</span>
            </>
          )}
        </div>
        <SLACountdown createdAt={case_.created_at} dueAt={case_.sla_due_at} status={case_.status} />
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block hover:no-underline">
        {content}
      </Link>
    )
  }
  return content
}