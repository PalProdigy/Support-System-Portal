'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { History } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { cn, timeAgo } from '@/lib/utils'

export interface ActivityItem {
  id: string
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  title: string
  description?: string
  timestamp: string
  href?: string
}

interface RecentActivityProps {
  items: ActivityItem[]
  isLoading?: boolean
  title?: string
  height?: number
  className?: string
}

export function RecentActivity({
  items, isLoading, title = 'Recent Activity', height = 600, className,
}: RecentActivityProps) {
  return (
    <div className={cn('rounded-xl border bg-card shadow-sm flex flex-col overflow-hidden', className)}>
      <div className="flex items-center justify-between px-4 py-3.5 border-b shrink-0">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          {title}
        </h3>
        {!isLoading && items.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
        )}
      </div>

      {isLoading ? (
        <div className="p-4 space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5 pt-0.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={History}
          title="No recent activity"
          description="Activity from your clients and cases will show up here."
          size="sm"
          className="py-10"
        />
      ) : (
        <ScrollArea style={{ height }}>
          <ul className="divide-y">
            {items.map((item) => {
              const Icon = item.icon
              const row = (
                <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', item.iconBg ?? 'bg-primary/10')}>
                    <Icon className={cn('h-4 w-4', item.iconColor ?? 'text-primary')} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground leading-snug">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground/80 mt-1">{timeAgo(item.timestamp)}</p>
                  </div>
                </div>
              )
              return (
                <li key={item.id}>
                  {item.href ? <Link href={item.href} className="block">{row}</Link> : row}
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      )}
    </div>
  )
}
