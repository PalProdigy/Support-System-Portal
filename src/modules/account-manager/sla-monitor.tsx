'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { PriorityChip } from '@/components/shared/priority-chip'
import { StatusBadge } from '@/components/shared/status-badge'
import { SLACountdown } from '@/components/shared/sla-countdown'
import { EmptyState } from '@/components/shared/empty-state'
import { useRouter } from 'next/navigation'
import { ShieldCheck, AlertTriangle, Clock, ArrowRight } from 'lucide-react'
import { cn, slaPercent, slaRemainingMs, formatDuration } from '@/lib/utils'
import type { Case, Client } from '@/types'

type SLABucket = 'breached' | 'critical' | 'at_risk'

interface SLARow {
  case_: Case
  client?: Client
  bucket: SLABucket
  percent: number
}

const BUCKET_CONFIG: Record<SLABucket, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  breached: { label: 'SLA Breached', color: 'text-red-600 dark:text-red-400', icon: AlertTriangle },
  critical: { label: 'Critical priority open', color: 'text-amber-600 dark:text-amber-400', icon: AlertTriangle },
  at_risk:  { label: 'At risk (>80% elapsed)', color: 'text-orange-600 dark:text-orange-400', icon: Clock },
}

export function SLAMonitor() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesPage, isLoading } = useQuery({
    queryKey: ['cases', session.userId, 'sla'],
    queryFn: () => dp.listCases(scope, { pageSize: 200 }),
  })

  const { data: clients } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
  })

  const clientsMap = useMemo(
    () => Object.fromEntries((clients ?? []).map((c) => [c.id, c])),
    [clients]
  )

  const rows: SLARow[] = useMemo(() => {
    const activeCases = (casesPage?.items ?? []).filter(
      (c: Case) => !['closed', 'resolved', 'pending_closure', 'pending_client'].includes(c.status)
    )
    const result: SLARow[] = []
    for (const c of activeCases) {
      const percent = slaPercent(c.created_at, c.sla_due_at)
      if (percent >= 100) {
        result.push({ case_: c, client: clientsMap[c.client_id], bucket: 'breached', percent })
      } else if (c.priority === 'critical') {
        result.push({ case_: c, client: clientsMap[c.client_id], bucket: 'critical', percent })
      } else if (percent >= 80) {
        result.push({ case_: c, client: clientsMap[c.client_id], bucket: 'at_risk', percent })
      }
    }
    // Sort: breached first, then critical, then at-risk; within each by percent desc
    const order: SLABucket[] = ['breached', 'critical', 'at_risk']
    result.sort((a, b) =>
      order.indexOf(a.bucket) - order.indexOf(b.bucket) || b.percent - a.percent
    )
    return result
  }, [casesPage, clientsMap])

  if (isLoading) return (
    <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
  )

  const breached = rows.filter((r) => r.bucket === 'breached')
  const atRisk = rows.filter((r) => r.bucket !== 'breached')

  return (
    <div className="space-y-6">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'SLA Breached', count: breached.length, color: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' },
          { label: 'At Risk / Critical', count: atRisk.length, color: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400' },
          { label: 'Healthy', count: Math.max(0, (casesPage?.total ?? 0) - rows.length), color: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' },
        ].map(({ label, count, color }) => (
          <div key={label} className={cn('rounded-xl border px-4 py-2.5 text-sm font-medium', color)}>
            <span className="text-xl font-bold tabular-nums">{count}</span>
            <span className="ml-2 text-xs font-normal">{label}</span>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="All SLAs on track"
          description="No breached or at-risk cases for your clients."
        />
      ) : (
        <div className="space-y-4">
          {(['breached', 'critical', 'at_risk'] as SLABucket[]).map((bucket) => {
            const items = rows.filter((r) => r.bucket === bucket)
            if (items.length === 0) return null
            const cfg = BUCKET_CONFIG[bucket]
            const Icon = cfg.icon
            return (
              <div key={bucket}>
                <div className={cn('flex items-center gap-1.5 text-sm font-semibold mb-2', cfg.color)}>
                  <Icon className="h-4 w-4" />
                  {cfg.label} ({items.length})
                </div>
                <div className="space-y-2">
                  {items.map(({ case_: c, client }) => {
                    const remaining = slaRemainingMs(c.sla_due_at)
                    const isBreached = remaining <= 0
                    return (
                      <div
                        key={c.id}
                        onClick={() => router.push(`/cases/${c.id}`)}
                        className={cn(
                          'rounded-xl border bg-card p-3.5 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow group',
                          isBreached && 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10'
                        )}
                      >
                        {/* Left */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground">{c.reference_no}</span>
                            <PriorityChip priority={c.priority} size="sm" />
                            <StatusBadge status={c.status} size="sm" />
                          </div>
                          <p className="text-sm font-medium truncate">{c.title}</p>
                          {client && <p className="text-xs text-muted-foreground">{client.company_name}</p>}
                        </div>

                        {/* SLA */}
                        <div className="shrink-0 w-28">
                          <SLACountdown createdAt={c.created_at} dueAt={c.sla_due_at} status={c.status} />
                          {isBreached && (
                            <p className="text-[10px] text-red-600 dark:text-red-400 font-medium mt-0.5">
                              Overdue by {formatDuration(Math.abs(remaining))}
                            </p>
                          )}
                        </div>

                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}