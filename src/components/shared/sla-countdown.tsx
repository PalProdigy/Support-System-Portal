'use client'

import { useState, useEffect, useRef } from 'react'
import { cn, slaRemainingMs, formatDuration } from '@/lib/utils'
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

  const remaining = slaRemainingMs(dueAt)

  void now

  if (remaining <= 0) return null

  return (
    <span className={cn('text-xs font-medium', isPaused && 'text-muted-foreground')}>
      {isPaused ? 'Paused' : formatDuration(remaining)}
    </span>
  )
}