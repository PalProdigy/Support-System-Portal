'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { toast } from '@/hooks/use-toast'
import { cn, formatDateTime, formatDuration, slaRemainingMs, PRIORITY_COLORS, PRIORITY_LABELS, STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'
import { AlertTriangle, ExternalLink, CheckCircle2, Zap, Clock } from 'lucide-react'

export function EscalationQueue() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }
  const router = useRouter()

  const { data: casesPage, isLoading } = useQuery({
    queryKey: ['cases', 'all-teams'],
    queryFn: () => dp.listCases(scope, { pageSize: 500 }),
    refetchInterval: 30_000,
  })

  const { data: teams }   = useQuery({ queryKey: ['teams'],          queryFn: () => dp.listTeams() })
  const { data: clients } = useQuery({ queryKey: ['clients', scope], queryFn: () => dp.listClients(scope) })
  const { data: users }   = useQuery({ queryKey: ['users'],          queryFn: () => dp.listUsers() })

  const teamsMap   = useMemo(() => Object.fromEntries((teams   ?? []).map((t) => [t.id, t.name])),    [teams])
  const clientsMap = useMemo(() => Object.fromEntries((clients ?? []).map((c) => [c.id, c.company_name])), [clients])
  const usersMap   = useMemo(() => Object.fromEntries((users   ?? []).map((u) => [u.id, u.name])),    [users])

  // SLA event dedup store to detect auto-escalations
  const autoEscalatedIds = useMemo(() => {
    if (typeof window === 'undefined') return new Set<string>()
    try {
      const raw = localStorage.getItem('nhq_sla_events')
      const events = raw ? JSON.parse(raw) as Array<{ case_id: string; type: string }> : []
      return new Set(events.filter((e) => e.type === 'unassigned_too_long').map((e) => e.case_id))
    } catch { return new Set<string>() }
  }, [casesPage]) // recompute when cases refresh

  const escalated = useMemo(() =>
    (casesPage?.items ?? []).filter((c) => c.is_escalated || c.status === 'escalated'),
    [casesPage]
  )

  // TH can move case back to in_progress to handle it directly
  const handleMutation = useMutation({
    mutationFn: (caseId: string) => dp.updateCase(caseId, { status: 'in_progress', is_escalated: false }, scope),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases'] })
      toast({ title: 'Case taken — moved to In Progress', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to update case', variant: 'destructive' }),
  })

  if (isLoading) return (
    <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
  )

  if (escalated.length === 0) return (
    <EmptyState icon={AlertTriangle} title="No escalated cases" description="Escalated cases will appear here." />
  )

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {escalated.length} escalated case{escalated.length !== 1 ? 's' : ''} — manual escalations and SLA auto-escalations combined.
      </p>
      {escalated.map((c) => {
        const rem    = slaRemainingMs(c.sla_due_at)
        const isAuto = autoEscalatedIds.has(c.id)
        return (
          <div key={c.id} className="rounded-xl border border-red-200 dark:border-red-800 bg-card p-4 space-y-3">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground">{c.reference_no}</span>
                  <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', PRIORITY_COLORS[c.priority])}>
                    {PRIORITY_LABELS[c.priority]}
                  </span>
                  {isAuto ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                      <Zap className="h-2.5 w-2.5" /> Auto-Escalated (SLA)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="h-2.5 w-2.5" /> Manual Escalation
                    </span>
                  )}
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[c.status])}>
                    {STATUS_LABELS[c.status]}
                  </span>
                </div>
                <p className="font-semibold text-sm text-foreground">{c.title}</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{clientsMap[c.client_id] ?? '—'}</span>
                  <span>{teamsMap[c.team_id] ?? c.team_id}</span>
                  {c.assignee_id && <span>Assigned to {usersMap[c.assignee_id] ?? c.assignee_id}</span>}
                  <span>Opened {formatDateTime(c.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className={cn('flex items-center gap-1 text-xs font-medium', rem < 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>
                  <Clock className="h-3 w-3" />
                  {rem < 0 ? `−${formatDuration(Math.abs(rem))}` : formatDuration(rem)}
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push(`/cases/${c.id}`)}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMutation.mutate(c.id)}
                  disabled={handleMutation.isPending}
                  className="text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Take / Resume
                </Button>
              </div>
            </div>
            {c.escalation_level > 0 && (
              <p className="text-xs text-muted-foreground border-t pt-2">
                Escalation level {c.escalation_level}
                {isAuto ? ' — triggered by SLA engine (unassigned for too long)' : ' — manually escalated by Module Lead'}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
