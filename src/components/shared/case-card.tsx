import Link from 'next/link'
import { useState, useEffect } from 'react'
import { PriorityChip } from './priority-chip'
import { StatusBadge } from './status-badge'
import { UserAvatar } from './user-avatar'
import { formatDateTime, formatDuration } from '@/lib/utils'
import type { Case, Client, User } from '@/types'
import { AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CaseCardProps {
  case_: Case
  client?: Client
  assignee?: User
  href?: string
  compact?: boolean
  unassigned?: boolean
  /** Right-aligned action (e.g. a "Grab Request" button) shown in place of the assignee. */
  action?: React.ReactNode
}

function formatQueuing(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}min`
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

function QueuingTime({ createdAt }: { createdAt: string }) {
  const [ms, setMs] = useState(() => Date.now() - new Date(createdAt).getTime())

  useEffect(() => {
    const id = setInterval(() => setMs(Date.now() - new Date(createdAt).getTime()), 10_000)
    return () => clearInterval(id)
  }, [createdAt])

  const intensity = ms > 86400_000 ? 'text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30' :
    ms > 43200_000 ? 'text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30' :
    'text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30'

  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${intensity}`}>
      <Clock className="h-3 w-3" />
      {formatQueuing(ms)}
    </span>
  )
}

export function CaseCard({ case_, client, assignee, href, compact, unassigned, action }: CaseCardProps) {
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
            <QueuingTime createdAt={case_.created_at} />
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
              <span className="flex items-center gap-1.5">
                <UserAvatar
                  name={assignee.name}
                  avatarUrl={assignee.avatar}
                  userId={assignee.id}
                  size="sm"
                  border={false}
                  shadow={false}
                />
                <span>{assignee.name}</span>
              </span>
            </>
          )}
          {!compact && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span>{formatDateTime(case_.created_at)}</span>
            </>
          )}
        </div>

        {action && (
          <div onClick={(e) => { e.preventDefault(); e.stopPropagation() }} className="shrink-0">
            {action}
          </div>
        )}
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