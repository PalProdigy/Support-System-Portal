'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { cn, formatDuration, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/utils'
import { Check, Clock, Hourglass, Inbox, Sparkles } from 'lucide-react'
import type { Client } from '@/types'

// Re-render on an interval so approval-window countdowns tick down live.
function useNow(intervalMs = 30_000): number {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return nowMs
}

/**
 * "New Cases" — freshly routed, still-unassigned cases an engineer can ask to
 * take. Accept sends a claim request to the Team Lead + Technical Head; the
 * case is only assigned once one of them approves. While the request is
 * pending the button flips to a "Requested" state.
 */
export function NewCases({ clientsMap }: { clientsMap: Record<string, Client> }) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const nowMs = useNow()
  const scope = { userId: session.userId, role: session.role }

  const { data: claimable } = useQuery({
    queryKey: ['claimable-cases', session.userId],
    queryFn: () => dp.listClaimableCases(scope),
    refetchInterval: 30_000,
  })
  const { data: myClaims } = useQuery({
    queryKey: ['case-claims', 'mine', session.userId],
    queryFn: () => dp.listCaseClaimRequests({ engineer_id: session.userId }),
    refetchInterval: 30_000,
  })

  const pendingClaimCaseIds = useMemo(
    () => new Set((myClaims ?? []).filter((c) => c.status === 'pending').map((c) => c.case_id)),
    [myClaims],
  )

  const requestClaim = useMutation({
    mutationFn: (caseId: string) => dp.requestCaseClaim(caseId, scope),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['case-claims'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast({
        title: 'Request sent',
        description: 'Your Team Lead and the Technical Head have been notified.',
        variant: 'success',
      })
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  const cases = claimable ?? []

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-sm font-semibold">New Cases</h2>
        <span className="text-[11px] text-muted-foreground">Unassigned cases routed to your team — accept to request them</span>
      </div>

      {cases.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2 flex items-center gap-2">
          <Inbox className="h-4 w-4" /> No new cases right now.
        </p>
      ) : (
        <div className="space-y-2.5">
          {cases.map((c) => {
            const requested = pendingClaimCaseIds.has(c.id)
            const remaining = c.approval_deadline ? new Date(c.approval_deadline).getTime() - nowMs : null
            return (
              <div key={c.id} className="rounded-lg border bg-card p-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{c.reference_no}</span>
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', PRIORITY_COLORS[c.priority])}>
                      {PRIORITY_LABELS[c.priority]}
                    </span>
                  </div>
                  <Link href={`/cases/${c.id}`} className="block text-sm font-medium text-foreground truncate hover:text-primary">
                    {c.title}
                  </Link>
                  <p className="text-[11px] mt-0.5 text-muted-foreground inline-flex items-center gap-1">
                    {clientsMap[c.client_id] && <span>{clientsMap[c.client_id].company_name} ·</span>}
                    <Clock className="h-3 w-3" />
                    {remaining == null
                      ? 'Awaiting assignment'
                      : remaining > 0
                        ? `${formatDuration(remaining)} left in the team-lead window`
                        : 'Window expired — with the Technical Head'}
                  </p>
                </div>
                {requested ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 shrink-0">
                    <Hourglass className="h-3.5 w-3.5" /> Requested
                  </span>
                ) : (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                    disabled={requestClaim.isPending}
                    onClick={() => requestClaim.mutate(c.id)}
                  >
                    <Check className="h-3.5 w-3.5" /> Accept
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
