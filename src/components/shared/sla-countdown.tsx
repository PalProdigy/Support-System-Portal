'use client'

import { useState, useEffect, useRef } from 'react'
import { cn, slaPercent, slaRemainingMs, formatDuration } from '@/lib/utils'
import type { CaseStatus } from '@/types'

interface SLACountdownProps {
  createdAt: string
  dueAt: string
  status: CaseStatus
}

const PAUSED_STATUSES: CaseStatus[] = ['pending_client', 'closed', 'resolved', 'pending_closure']

export function SLACountdown({ createdAt, dueAt, status }: SLACountdownProps) {
  const [now, setNow] = useState(Date.now())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isPaused = PAUSED_STATUSES.includes(status)

  useEffect(() => {
    if (isPaused) return
    intervalRef.current = setInterval(() => setNow(Date.now()), 60_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPaused])

  const percent = slaPercent(createdAt, dueAt)
  const remaining = slaRemainingMs(dueAt)
  const isBreached = remaining <= 0
  const isWarning = !isBreached && percent >= 80

  const barColor = isBreached
    ? 'bg-red-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-emerald-500'

  const textColor = isBreached
    ? 'text-red-600 dark:text-red-400'
    : isWarning
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400'

  void now // used to trigger re-render

  return (
    <div className="flex flex-col gap-1 min-w-[120px]">
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <span className={cn('text-xs font-medium', textColor, isPaused && 'text-muted-foreground')}>
        {isPaused ? 'Paused' : formatDuration(remaining)}
      </span>
    </div>
  )
}