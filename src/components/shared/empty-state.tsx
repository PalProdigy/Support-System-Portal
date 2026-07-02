import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
  size?: 'sm' | 'md'
}

export function EmptyState({
  icon: Icon = Inbox, title, description, action, className, size = 'md',
}: EmptyStateProps) {
  const isSm = size === 'sm'
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', isSm ? 'py-4' : 'py-16', className)}>
      <div className={cn('rounded-full bg-muted mb-2', isSm ? 'p-2' : 'p-4 mb-4')}>
        <Icon className={cn('text-muted-foreground', isSm ? 'h-4 w-4' : 'h-8 w-8')} />
      </div>
      <h3 className={cn('font-semibold text-foreground', isSm ? 'text-sm' : 'text-lg')}>{title}</h3>
      {description && <p className={cn('text-muted-foreground max-w-xs', isSm ? 'mt-0.5 text-xs' : 'mt-1 text-sm')}>{description}</p>}
      {action && (
        <Button className={cn(isSm ? 'mt-2 h-7 text-xs' : 'mt-4')} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}