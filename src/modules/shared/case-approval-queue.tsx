'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { AssignDialog } from '@/modules/lead/assign-dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { cn, formatDuration, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/utils'
import {
  Clock, ExternalLink, TimerReset, UserPlus, AlarmClockOff, Check, X, UserRound,
} from 'lucide-react'
import type { Case, CaseClaimRequest, User } from '@/types'

// Re-render on an interval so the 30-minute countdowns tick down live.
function useNow(intervalMs = 30_000): number {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return nowMs
}

export interface CaseApprovalQueueProps {
  /** All cases visible to the current user (the component buckets them itself). */
  cases: Case[]
  users: User[]
  /** The lead's team id — scopes the Overdue tab for a TL. Omit for a Technical Head. */
  teamId?: string
}

/**
 * The "Awaiting Your Approval" case queue, shared by the Team Lead and
 * Technical Head dashboards. Two views:
 *
 * - **Awaiting (0–30 min)** — cases routed to me still inside the approval
 *   window, soonest-ending first, each with a green Assign button.
 * - **Overdue** — cases whose window expired (escalated to the Technical Head)
 *   and still unassigned: red cards with a red Assign button. Assigning from
 *   either view settles the approval and removes the case from both queues.
 *
 * Cases with a pending engineer claim show the engineer's name with
 * Accept / Reject; accepting assigns the case to that engineer.
 */
export function CaseApprovalQueue({ cases, users, teamId }: CaseApprovalQueueProps) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()
  const nowMs = useNow()
  const scope = { userId: session.userId, role: session.role }

  const [assignTarget, setAssignTarget] = useState<Case | null>(null)

  const { data: claims } = useQuery({
    queryKey: ['case-claims', 'pending'],
    queryFn: () => dp.listCaseClaimRequests({ status: 'pending' }),
    refetchInterval: 30_000,
  })
  const claimsByCase = useMemo(() => {
    const map = new Map<string, CaseClaimRequest[]>()
    for (const cl of claims ?? []) {
      map.set(cl.case_id, [...(map.get(cl.case_id) ?? []), cl])
    }
    return map
  }, [claims])

  const resolveClaim = useMutation({
    mutationFn: ({ claim, decision }: { claim: CaseClaimRequest; decision: 'approved' | 'rejected' }) =>
      dp.resolveCaseClaim(claim.id, decision, scope),
    onSuccess: (_res, { claim, decision }) => {
      qc.invalidateQueries({ queryKey: ['cases'] })
      qc.invalidateQueries({ queryKey: ['case-claims'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast({
        title: decision === 'approved' ? 'Case assigned' : 'Request declined',
        description: decision === 'approved'
          ? `Assigned to ${claim.engineer_name ?? claim.engineer_id}`
          : `${claim.engineer_name ?? 'The engineer'} was notified`,
        variant: decision === 'approved' ? 'success' : 'default',
      })
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  // Cases routed to ME, still inside the 30-minute window — soonest-ending first.
  const pending = useMemo(() => cases
    .filter((c) => c.approval_status === 'pending' && c.approval_user_id === session.userId && !c.assignee_id)
    .sort((a, b) => new Date(a.approval_deadline ?? 0).getTime() - new Date(b.approval_deadline ?? 0).getTime()),
    [cases, session.userId])

  // Window expired, escalated to the Technical Head, and still unassigned.
  // The TL keeps seeing their team's overdue cases; the TH sees all of them.
  const overdue = useMemo(() => cases
    .filter((c) =>
      c.approval_status === 'escalated' && !c.assignee_id &&
      (session.role === 'technical_head' || !teamId || c.approval_team_id === teamId))
    .sort((a, b) => new Date(a.approval_deadline ?? 0).getTime() - new Date(b.approval_deadline ?? 0).getTime()),
    [cases, session.role, teamId])

  if (pending.length === 0 && overdue.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">Nothing awaiting approval right now.</p>
    )
  }

  // Engineers eligible for the selected case: active SEs on the routed team
  // (falls back to all active SEs when the team has none).
  const engineersFor = (c: Case): User[] => {
    const routedTeam = c.approval_team_id ?? c.team_id
    const team = users.filter((u) => u.role === 'support_engineer' && u.is_active && u.team_id === routedTeam)
    return team.length > 0 ? team : users.filter((u) => u.role === 'support_engineer' && u.is_active)
  }

  const renderCard = (c: Case, isOverdue: boolean) => {
    const remaining = c.approval_deadline ? new Date(c.approval_deadline).getTime() - nowMs : null
    const urgent = !isOverdue && remaining != null && remaining < 5 * 60_000
    const caseClaims = claimsByCase.get(c.id) ?? []

    return (
      <div
        key={c.id}
        className="rounded-lg border bg-card p-3"
      >
        <div className="flex flex-col gap-2">
          {/* Meta row — wraps instead of overflowing on narrow screens */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[11px] text-muted-foreground">{c.reference_no}</span>

            <span className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap',
                PRIORITY_COLORS[c.priority],
            )}>
              {PRIORITY_LABELS[c.priority]}
            </span>

            {isOverdue && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                    <AlarmClockOff className="h-3 w-3 shrink-0" /> Time exceeded
                </span>
              )}
          </div>

          {/* Body — stacked on mobile, side-by-side from sm up */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{c.title}</p>

              <p className={cn(
                  'text-[11px] mt-0.5 flex items-start gap-1',
                  isOverdue || urgent
                      ? 'text-red-600 dark:text-red-400 font-semibold'
                      : 'text-muted-foreground',
              )}>
                <Clock className="h-3 w-3 shrink-0 mt-[2px]" />
                <span className="min-w-0">
                  {isOverdue
                      ? remaining != null
                          ? `30-min window ended ${formatDuration(-remaining)} ago — awaiting Technical Head assignment`
                          : 'Waiting for Technical Head Assignment'
                      : remaining == null
                          ? 'No deadline'
                          : remaining <= 0
                              ? 'Deadline passed'
                              : `${formatDuration(remaining)} left`}
                  </span>
              </p>
            </div>

            {/* Actions — full-width row on mobile, compact on desktop */}
            <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
              <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={`Open case ${c.reference_no}`}
                  onClick={() => router.push(`/cases/${c.id}`)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>

              <Button
                  size="sm"
                  className={cn(
                      'text-white flex-1 sm:flex-none gap-1.5',
                      isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700',
                  )}
                  onClick={() => setAssignTarget(c)}
              >
                <UserPlus className="h-3.5 w-3.5" /> Assign
              </Button>
            </div>
          </div>
        </div>

        {/* Engineer claim requests — the SE's name with Accept / Reject */}
        {caseClaims.length > 0 && (
          <div className="mt-2.5 space-y-1.5 border-t pt-2.5">
            {caseClaims.map((cl) => (
              <div key={cl.id} className="flex items-center gap-2">
                <UserRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground min-w-0 flex-1 truncate">
                  <span className="font-medium text-foreground">{cl.engineer_name ?? cl.engineer_id}</span> wants to take this case
                </p>
                <Button
                  size="sm"
                  className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={resolveClaim.isPending}
                  onClick={() => resolveClaim.mutate({ claim: cl, decision: 'approved' })}
                >
                  <Check className="h-3.5 w-3.5" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-red-600 dark:text-red-400 border-red-300 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40"
                  disabled={resolveClaim.isPending}
                  onClick={() => resolveClaim.mutate({ claim: cl, decision: 'rejected' })}
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Tabs defaultValue={pending.length > 0 ? 'pending' : 'overdue'}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            <TimerReset className="h-3.5 w-3.5" /> Awaiting (0–30 min) ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="overdue" className={cn('gap-1.5', overdue.length > 0 && 'text-red-600 dark:text-red-400')}>
            <AlarmClockOff className="h-3.5 w-3.5" /> Overdue ({overdue.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-3">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No cases inside the 30-minute window.</p>
          ) : (
            <div className="space-y-2.5">{pending.map((c) => renderCard(c, false))}</div>
          )}
        </TabsContent>
        <TabsContent value="overdue" className="mt-3">
          {overdue.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No overdue cases — every window was handled in time.</p>
          ) : (
            <div className="space-y-2.5">{overdue.map((c) => renderCard(c, true))}</div>
          )}
        </TabsContent>
      </Tabs>

      <AssignDialog
        open={assignTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAssignTarget(null)
            // Assigning auto-settles claim requests — refresh their list too.
            qc.invalidateQueries({ queryKey: ['case-claims'] })
          }
        }}
        caseData={assignTarget}
        engineers={assignTarget ? engineersFor(assignTarget) : []}
      />
    </>
  )
}
