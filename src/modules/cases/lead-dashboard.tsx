'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { NewCaseDialog } from '@/modules/cases/new-case-dialog'
import { PlusCircle } from 'lucide-react'

// Attention buckets + case updates feed + license/SLA expiry + engineer
// workload/performance, all team-scoped — client-only, same as its TH sibling.
const LeadTeamDashboard = dynamic(
  () => import('@/modules/lead/lead-team-dashboard').then((m) => m.LeadTeamDashboard),
  { ssr: false, loading: () => <div className="h-96 rounded-xl border bg-card animate-pulse" /> },
)

export default function LeadDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }
  const [newCaseOpen, setNewCaseOpen] = useState(false)

  const { data: casesData, error, refetch } = useQuery({
    queryKey: ['cases', 'lead', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 200 }),
    refetchInterval: 60_000,
  })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })

  const myUser = (users ?? []).find((u) => u.id === session.userId)
  const myTeam = (teams ?? []).find((t) => t.id === myUser?.team_id)
  const teamSize = (users ?? []).filter((u) => u.role === 'support_engineer' && u.team_id === myUser?.team_id && u.is_active).length

  if (error) return <ErrorState onRetry={refetch} />

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Team Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {myTeam ? myTeam.name : 'Your team'} · {teamSize} engineer{teamSize !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setNewCaseOpen(true)}>
          <PlusCircle className="h-4 w-4" /> New Case
        </Button>
      </div>

      <NewCaseDialog open={newCaseOpen} onOpenChange={setNewCaseOpen} />

      {/* Escalated / Closure Rejected / Queuing / 3+ Month watchlist, case
          updates feed, license & SLA expiry, engineer workload & performance */}
      <LeadTeamDashboard />
    </div>
  )
}
