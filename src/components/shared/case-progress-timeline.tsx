'use client'

import { useMemo } from 'react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Circle, Clock } from 'lucide-react'
import { formatDateTime, slaRemainingMs, slaPercent } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Case, CaseStatus } from '@/types'

const STAGE_ORDER: CaseStatus[] = ['new', 'triaged', 'assigned', 'in_progress', 'pending_client', 'resolved', 'closed']
const STAGE_LABELS: Record<CaseStatus, string> = {
  new: 'New',
  triaged: 'Triaged',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending_client: 'Pending Client',
  resolved: 'Resolved',
  closed: 'Closed',
  escalated: 'Escalated',
  pending_closure: 'Pending Closure',
}

interface CaseProgressTimelineProps {
  case_: Case
  auditLogs?: any[]
}

export function CaseProgressTimeline({ case_, auditLogs = [] }: CaseProgressTimelineProps) {
  const stages = useMemo(() => {
    const result: Array<{ status: CaseStatus; timestamp?: string; isActive: boolean; isCompleted: boolean }> = []

    for (const status of STAGE_ORDER) {
      const log = auditLogs.find((l) => l.action === 'status_change' && l.after?.status === status)
      const timestamp = log?.created_at

      const isCompleted = STAGE_ORDER.indexOf(status) < STAGE_ORDER.indexOf(case_.status)
      const isActive = status === case_.status

      result.push({ status, timestamp, isCompleted, isActive })
    }

    return result
  }, [case_, auditLogs])

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div>
        <p className="text-sm font-semibold mb-3">Progress Timeline</p>
        <div className="space-y-3">
          {stages.map((stage, idx) => {
            const isFirst = idx === 0
            const isLast = idx === stages.length - 1
            return (
              <div key={stage.status} className="flex gap-3">
                {/* Timeline marker */}
                <div className="flex flex-col items-center">
                  <div className={cn('h-5 w-5 rounded-full flex items-center justify-center transition-all', stage.isCompleted ? 'bg-green-600' : stage.isActive ? 'bg-blue-600' : 'bg-muted')}>
                    {stage.isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    ) : stage.isActive ? (
                      <Circle className="h-4 w-4 text-white" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                  {!isLast && (
                    <div className={cn('w-0.5 h-8 my-0.5', stage.isCompleted ? 'bg-green-600' : 'bg-border')} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 py-0.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={cn('text-sm font-medium', stage.isActive && 'text-blue-600 dark:text-blue-400')}>
                      {STAGE_LABELS[stage.status]}
                    </p>
                    {stage.isActive && <Badge variant="secondary" className="text-xs">Current</Badge>}
                  </div>
                  {stage.timestamp && (
                    <p className="text-xs text-muted-foreground">{formatDateTime(stage.timestamp)}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface SLAProgressProps {
  case_: Case
}

export function SLAProgress({ case_ }: SLAProgressProps) {
  const remaining = slaRemainingMs(case_.sla_due_at)
  const percent = slaPercent(case_.created_at, case_.sla_due_at)
  const isBreached = remaining <= 0
  const isAtRisk = percent >= 80 && !isBreached

  const hoursRemaining = Math.abs(remaining / (1000 * 60 * 60))
  const statusText = isBreached
    ? `Breached by ${Math.floor(hoursRemaining)}h`
    : `${Math.floor(hoursRemaining)}h remaining`

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">SLA Details</p>
        <Badge
          variant={isBreached ? 'destructive' : isAtRisk ? 'secondary' : 'default'}
          className={cn(
            'text-xs',
            isBreached && 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
            isAtRisk && 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
          )}
        >
          {isBreached ? 'Breached' : isAtRisk ? 'At Risk' : 'On Track'}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className={cn('font-medium', isBreached && 'text-red-600 dark:text-red-400', isAtRisk && 'text-amber-600 dark:text-amber-400')}>
            {Math.min(100, Math.max(0, percent)).toFixed(0)}%
          </span>
        </div>
        <Progress
          value={Math.min(100, Math.max(0, percent))}
          className={cn(
            'h-2',
            isBreached && '[&>*]:bg-red-600',
            isAtRisk && '[&>*]:bg-amber-600'
          )}
        />
      </div>

      <div className="pt-2 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">SLA Deadline:</span>
          <span className="font-medium">{formatDateTime(case_.sla_due_at)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status:</span>
          <span className={cn('font-medium', isBreached && 'text-red-600 dark:text-red-400', isAtRisk && 'text-amber-600 dark:text-amber-400')}>
            {statusText}
          </span>
        </div>
        {case_.resolved_at && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Resolved:</span>
            <span className="font-medium">{formatDateTime(case_.resolved_at)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
