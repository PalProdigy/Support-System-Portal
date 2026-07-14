'use client'

import { useMemo, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Clock } from 'lucide-react'
import { cn, slaPercent, slaRemainingMs } from '@/lib/utils'
import type { Case } from '@/types'

interface SLABreachWidgetProps {
  cases: Case[]
  isLoading?: boolean
  onRefresh?: () => void
  /** Render just the two tiles (no "SLA Health" label, grid, or status message) so they can sit inline in a parent grid alongside other stat cards. */
  inline?: boolean
}

export function SLABreachWidget({ cases, isLoading, onRefresh, inline }: SLABreachWidgetProps) {
  const router = useRouter()
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)

  const stats = useMemo(() => {
    const activeCases = cases.filter(
      (c) => !['closed', 'resolved', 'pending_closure'].includes(c.status)
    )

    const breached = activeCases.filter((c) => {
      const remaining = slaRemainingMs(c.sla_due_at)
      return remaining <= 0
    })

    const atRisk = activeCases.filter((c) => {
      const remaining = slaRemainingMs(c.sla_due_at)
      const percent = slaPercent(c.created_at, c.sla_due_at)
      return remaining > 0 && percent >= 80
    })

    return { breached: breached.length, atRisk: atRisk.length }
  }, [cases])

  // Set up polling for real-time updates (30-second interval)
  useEffect(() => {
    if (!onRefresh) return

    const interval = setInterval(() => {
      onRefresh()
    }, 30000) // 30 seconds

    setPollInterval(interval)
    return () => clearInterval(interval)
  }, [onRefresh])

  const handleClick = (type: 'breached' | 'at-risk') => {
    if (type === 'breached' && stats.breached > 0) {
      router.push('/cases?sla=breached')
    } else if (type === 'at-risk' && stats.atRisk > 0) {
      router.push('/cases?sla=at-risk')
    }
  }

  const hasIssues = stats.breached > 0 || stats.atRisk > 0

  if (isLoading) {
    return inline ? (
      <>
        <div className="h-full min-h-[92px] rounded-xl bg-muted animate-pulse" />
        <div className="h-full min-h-[92px] rounded-xl bg-muted animate-pulse" />
      </>
    ) : (
      <div className="h-24 rounded-xl bg-muted animate-pulse" />
    )
  }

  const tiles = (
    <>
      {/* Breached */}
      <div
        onClick={() => handleClick('breached')}
        className={cn(
          'h-full rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md',
          stats.breached > 0
            ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
            : 'border-border bg-card'
        )}
      >
        <div className="flex items-start justify-between mb-2">
          <AlertTriangle
            className={cn(
              'h-5 w-5',
              stats.breached > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
            )}
          />
          <span className={cn('text-2xl font-bold tabular-nums', stats.breached > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>
            {stats.breached}
          </span>
        </div>
        <p className={cn('text-xs font-medium', stats.breached > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
          Breaching SLA
        </p>
      </div>

      {/* At Risk */}
      <div
        onClick={() => handleClick('at-risk')}
        className={cn(
          'h-full rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md',
          stats.atRisk > 0
            ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'
            : 'border-border bg-card'
        )}
      >
        <div className="flex items-start justify-between mb-2">
          <Clock
            className={cn(
              'h-5 w-5',
              stats.atRisk > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
            )}
          />
          <span className={cn('text-2xl font-bold tabular-nums', stats.atRisk > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
            {stats.atRisk}
          </span>
        </div>
        <p className={cn('text-xs font-medium', stats.atRisk > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
          At Risk (within 2h)
        </p>
      </div>
    </>
  )

  if (inline) return tiles

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SLA Health</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tiles}
      </div>

      {/* Status message */}
      {hasIssues && (
        <p className="text-xs text-muted-foreground px-1">
          {stats.breached > 0 && `${stats.breached} case${stats.breached !== 1 ? 's' : ''} breaching SLA. `}
          {stats.atRisk > 0 && `${stats.atRisk} at risk.`}
        </p>
      )}
    </div>
  )
}
