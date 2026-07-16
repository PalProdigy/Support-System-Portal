import { cn } from '@/lib/utils'
import { KB_STATUS_COLORS, KB_STATUS_LABELS } from './constants'
import type { KBArticleStatus } from '@/types'

export function KBStatusBadge({ status, className }: { status: KBArticleStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', KB_STATUS_COLORS[status], className)}>
      {KB_STATUS_LABELS[status]}
    </span>
  )
}
