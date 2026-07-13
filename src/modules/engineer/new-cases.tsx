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
import type { Client, Priority } from '@/types'

// Illustrative "client just filed this" case — always shown first so an
// engineer always has an example of the Grab Request flow, even when their
// team has no real unassigned cases right now. Grabbing it is fully real: it
// creates an actual case (auto-routed for team-lead approval like any client
// submission) and sends a genuine claim request to the Team Lead + Technical
// Head, exactly like requesting a real case above.
const DEMO_CASE = {
  reference_no: 'NHQ-DEMO-0002',
  title: 'Sample case — Email sync failing on mobile devices',
  description: 'Client reports that a subset of users can no longer sync their mailbox on mobile after the latest policy update; desktop clients are unaffected.',
  priority: 'medium' as Priority,
}

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
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
  const { data: solutions } = useQuery({ queryKey: ['solutions'], queryFn: () => dp.listSolutions() })
  const { data: slaRules } = useQuery({ queryKey: ['sla-rules'], queryFn: () => dp.listSLARules() })

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

  // Demo case prerequisites — this engineer's team, a client and a service the
  // team supports, so the created case routes exactly like a real submission.
  const myTeamId = (users ?? []).find((u) => u.id === session.userId)?.team_id
  const myTeam = (teams ?? []).find((t) => t.id === myTeamId)
  const demoClientId = Object.values(clientsMap)[0]?.id
  const demoSolutionId = (solutions ?? []).find((s) => (myTeam?.solution_ids ?? []).includes(s.id))?.id ?? solutions?.[0]?.id
  const demoSlaRuleId = (slaRules ?? []).find((r) => r.priority === DEMO_CASE.priority)?.id ?? slaRules?.[0]?.id

  const [demoRequested, setDemoRequested] = useState(false)

  const grabDemoCase = useMutation({
    mutationFn: async () => {
      if (!demoClientId || !demoSolutionId || !myTeamId) throw new Error('Missing client, solution or team for the demo case')
      const created = await dp.createCase({
        title: DEMO_CASE.title,
        description: DEMO_CASE.description,
        priority: DEMO_CASE.priority,
        status: 'new',
        client_id: demoClientId,
        solution_id: demoSolutionId,
        team_id: myTeamId,
        sla_rule_id: demoSlaRuleId ?? '',
        sla_due_at: new Date(Date.now() + 4 * 3_600_000).toISOString(),
        escalation_level: 0,
        is_escalated: false,
      }, scope)
      return dp.requestCaseClaim(created.id, scope)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases'] })
      qc.invalidateQueries({ queryKey: ['claimable-cases'] })
      qc.invalidateQueries({ queryKey: ['case-claims'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast({
        title: 'Request sent',
        description: 'Your Team Lead and the Technical Head have been notified.',
        variant: 'success',
      })
      setDemoRequested(true)
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  const cases = claimable ?? []

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        {/*<Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />*/}
        <h2 className="text-sm font-semibold">New Assignments</h2>
      </div>

      <div className="space-y-2.5">
        {!demoRequested && (
          <div className="rounded-lg border border-dashed bg-card/60 p-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] text-muted-foreground">{DEMO_CASE.reference_no}</span>
                {/*<span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', PRIORITY_COLORS[DEMO_CASE.priority])}>*/}
                {/*  {PRIORITY_LABELS[DEMO_CASE.priority]}*/}
                {/*</span>*/}
                {/*<span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">*/}
                {/*  <Sparkles className="h-3 w-3" /> Demo*/}
                {/*</span>*/}
              </div>
              <p className="text-sm font-medium text-foreground truncate">{DEMO_CASE.title}</p>
              <p className="text-[11px] mt-0.5 text-muted-foreground inline-flex items-center gap-1">
                {Object.values(clientsMap)[0] && <span>{Object.values(clientsMap)[0].company_name} ·</span>}
                <Clock className="h-3 w-3" /> Just filed by the client — not yet assigned
              </p>
            </div>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              disabled={grabDemoCase.isPending}
              onClick={() => grabDemoCase.mutate()}
            >
              <Check className="h-3.5 w-3.5" /> Grab Request
            </Button>
          </div>
        )}

        {cases.length === 0 && demoRequested ? (
          <p className="text-sm text-muted-foreground py-2 flex items-center gap-2">
            <Inbox className="h-4 w-4" /> No new cases right now.
          </p>
        ) : (
          cases.map((c) => {
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
                    <Check className="h-3.5 w-3.5" /> Grab Request
                  </Button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
