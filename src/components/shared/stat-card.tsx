import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: ReactNode
  icon?: LucideIcon
  iconColor?: string
  trend?: { value: number; label: string }
  loading?: boolean
  className?: string
}

export function StatCard({
  title, value, subtitle, icon: Icon, iconColor = 'text-primary',
  trend, loading, className,
}: StatCardProps) {
  if (loading) {
    return (
      <div className={cn('h-full rounded-xl border bg-card p-5 shadow-sm', className)}>
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-32" />
      </div>
    )
  }

  return (
    <div className={cn('h-full rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md', className)}>
      <div className="flex h-full items-start justify-between gap-3">
        <div className="flex-1 min-w-0 flex flex-col">
          <p className=" text-xs sm:text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground leading-snug">{subtitle}</p>}
          {trend && (
            <p className={cn('mt-2 text-xs font-medium', trend.value >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        {Icon && (
          <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        )}
      </div>
    </div>
  )
}