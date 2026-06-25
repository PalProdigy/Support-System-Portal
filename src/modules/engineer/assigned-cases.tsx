'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { EmptyState } from '@/components/shared/empty-state'
import { cn, slaRemainingMs, formatDuration, formatDate, PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'
import { Ticket, Clock, AlertCircle, ChevronRight, CheckCircle2, Play } from 'lucide-react'

export function AssignedCases() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }
  const router = useRouter()

  const { data: casesPage, isLoading } = useQuery({
    queryKey: ['cases', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 100 }),
    refetchInterval: 60_000,
  })

  const { data: solutions } = useQuery({
    queryKey: ['solutions'],
    queryFn: () => dp.listSolutions(),
  })

  const { data: clients } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => dp.listClients({ userId: session.userId, role: 'module_lead' }),
  })

  const solutionsMap = Object.fromEntries((solutions ?? []).map((s) => [s.id, s.name]))
  const clientsMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.company_name]))

  const cases = casesPage?.items ?? []

  const active = cases.filter((c) => !['closed', 'resolved', 'pending_closure'].includes(c.status))
  const done = cases.filter((c) => ['resolved', 'pending_closure', 'closed'].includes(c.status))

  if (isLoading) return (
    <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
  )

  if (cases.length === 0) return (
    <EmptyState icon={Ticket} title="No assigned cases" description="Cases assigned to you will appear here." />
  )

  function CaseCard({ c }: { c: (typeof cases)[0] }) {
    const remaining = slaRemainingMs(c.sla_due_at)
    const breached = remaining < 0
    const isActive = !['closed', 'resolved', 'pending_closure'].includes(c.status)
    const needsStart = c.status === 'assigned'
    const waitingClient = c.status === 'pending_client'

    return (
      <div
        onClick={() => router.push(`/engineer/${c.id}`)}
        className={cn(
          'rounded-xl border bg-card p-4 cursor-pointer hover:bg-accent/20 transition-colors space-y-2',
          needsStart && 'border-primary/30 bg-primary/5',
          breached && isActive && 'border-red-300 dark:border-red-800 bg-red-50/20 dark:bg-red-950/10',
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground">{c.reference_no}</span>
              <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', PRIORITY_COLORS[c.priority])}>
                {PRIORITY_LABELS[c.priority]}
              </span>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[c.status])}>
                {STATUS_LABELS[c.status]}
              </span>
            </div>
            <p className="font-semibold text-sm text-foreground truncate">{c.title}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {clientsMap[c.client_id] && <span>{clientsMap[c.client_id]}</span>}
              {clientsMap[c.client_id] && solutionsMap[c.solution_id] && <span>·</span>}
              {solutionsMap[c.solution_id] && <span>{solutionsMap[c.solution_id]}</span>}
            </div>
          </div>
          <div className="shrink-0 text-right space-y-1.5">
            {isActive && (
              <div className={cn('flex items-center gap-1 text-xs font-medium', breached ? 'text-red-600 dark:text-red-400' : remaining < 4 * 3600 * 1000 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                <Clock className="h-3 w-3" />
                {breached ? `−${formatDuration(Math.abs(remaining))}` : formatDuration(remaining)}
              </div>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
          </div>
        </div>

        {needsStart && (
          <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
            <Play className="h-3 w-3" /> Ready to start — click to open workspace
          </div>
        )}
        {waitingClient && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3 w-3" /> Awaiting client response
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Active cases */}
      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{active.length} active</p>
          {active.map((c) => <CaseCard key={c.id} c={c} />)}
        </div>
      )}

      {/* Done cases */}
      {done.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            {done.length} resolved / closed
          </p>
          {done.map((c) => <CaseCard key={c.id} c={c} />)}
        </div>
      )}

      <p className="text-xs text-muted-foreground">Opened between {formatDate(cases[cases.length - 1]?.created_at ?? '')} – {formatDate(cases[0]?.created_at ?? '')}</p>
    </div>
  )
}
