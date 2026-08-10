'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { ErrorState } from '@/components/shared/error-state'
import { CaseApprovalQueue } from '@/modules/shared/case-approval-queue'
import { Button } from '@/components/ui/button'
import { TimerReset, Handshake, ArrowRight } from 'lucide-react'

// Recharts widget — client-only so it stays out of SSR.
const CaseSummary12m = dynamic(
  () => import('@/modules/technical-head/case-summary-12m').then((m) => m.CaseSummary12m),
  { ssr: false, loading: () => <div className="h-[336px] rounded-xl border bg-card animate-pulse" /> },
)
// Attention buckets + license/SLA expiry + engineer workload + performance —
// client-only since the workload chart pulls in recharts transitively.
const THDashboard = dynamic(
  () => import('@/modules/technical-head/th-dashboard').then((m) => m.THDashboard),
  { ssr: false, loading: () => <div className="h-96 rounded-xl border bg-card animate-pulse" /> },
)

export default function TechHeadDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesData, error: casesError, refetch } = useQuery({
    queryKey: ['cases', 'all', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 500 }),
  })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: engagements } = useQuery({ queryKey: ['engagements', session.userId, session.role], queryFn: () => dp.listEngagements(scope) })

  const cases = useMemo(() => casesData?.items ?? [], [casesData])
  // Routing-approval queue: cases pending directly with the TH (no team owns
  // the service) plus overdue ones no team lead assigned within 30 minutes.
  const approvalQueueCount = useMemo(
    () => cases.filter((c) =>
      !c.assignee_id &&
      (c.approval_status === 'escalated' || (c.approval_status === 'pending' && c.approval_user_id === session.userId))
    ).length,
    [cases, session.userId]
  )
  // Engagement product lines an AM has submitted that still need a Team
  // (poc/support) or engineers (installation) assigned — a line can need both.
  const pendingEngagementLines = useMemo(
    () => (engagements ?? []).flatMap((e) => e.products).filter((p) => {
      const needsTeam = p.types.some((t) => t === 'poc' || t === 'support') && !p.assigned_team_id
      const needsHandlers = p.types.includes('installation') && !p.assigned_handler_ids?.length
      return needsTeam || needsHandlers
    }).length,
    [engagements]
  )

  if (session.role !== 'technical_head') return null
  if (casesError) return <ErrorState onRetry={refetch} />

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        </div>
      </div>

      {/* Engagements awaiting product-line assignment */}
      {pendingEngagementLines > 0 && (
        <div className="rounded-xl flex border bg-card p-4 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Handshake className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                <h3 className="text-sm font-semibold text-foreground">Orders need assignment</h3>
              </div>
            <span className="text-[11px] text-muted-foreground">
              {pendingEngagementLines} product line{pendingEngagementLines !== 1 ? 's' : ''} waiting for a team or engineer
            </span>
          </div>
          <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={() => router.push('/engagements')}>
            Assign <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Escalated / Reopened / Closure Rejected / Long Queuing / 3+ Month watchlist,
          license & SLA expiry, engineer workload, engineer performance extremes */}
      <THDashboard />

      {/* Routing approval queue — new cases + overdue team-lead windows */}
      {approvalQueueCount > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TimerReset className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-semibold text-foreground">Case Assignment Queue</h3>
            <span className="text-[11px] text-muted-foreground">
              Unassigned cases — including team-lead windows that ran past 30 minutes
            </span>
          </div>
          <CaseApprovalQueue cases={cases} users={users ?? []} />
        </div>
      )}

      {/* Last 12 months case summary */}
      <CaseSummary12m />
    </div>
  )
}
