import { cn, PRIORITY_COLORS, PRIORITY_DOT, PRIORITY_LABELS } from '@/lib/utils'
import type { Priority } from '@/types'

interface PriorityChipProps {
  priority: Priority
  size?: 'sm' | 'md'
  showDot?: boolean
}

export function PriorityChip({ priority, size = 'md', showDot = true }: PriorityChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        PRIORITY_COLORS[priority]
      )}
    >
      {showDot && <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT[priority])} />}
      {PRIORITY_LABELS[priority]}
    </span>
  )
}