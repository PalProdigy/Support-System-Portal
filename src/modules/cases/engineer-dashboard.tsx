'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { NewCaseDialog } from '@/modules/cases/new-case-dialog'
import { Wrench, PlusCircle } from 'lucide-react'

// Current-year KPIs + certifications/satisfaction/solutions/queuing, weekly
// workhours and case-updates feed — client-only, same pattern as its TH/Lead siblings.
const EngineerWidgets = dynamic(
  () => import('@/modules/engineer/engineer-widgets').then((m) => m.EngineerWidgets),
  { ssr: false, loading: () => <div className="h-96 rounded-xl border bg-card animate-pulse" /> },
)

export default function EngineerDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }
  const [newCaseOpen, setNewCaseOpen] = useState(false)

  const { error, refetch } = useQuery({
    queryKey: ['cases', 'engineer', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 200 }),
    refetchInterval: 60_000,
  })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
  const { data: notifications } = useQuery({ queryKey: ['notifications', session.userId], queryFn: () => dp.listNotifications(session.userId) })

  const myUser = (users ?? []).find((u) => u.id === session.userId)
  const myTeam = (teams ?? []).find((t) => t.id === myUser?.team_id)
  const teamLead = (users ?? []).find((u) => u.id === myTeam?.lead_user_id)
  const unreadCount = (notifications ?? []).filter((n) => !n.read_at).length

  if (error) return <ErrorState onRetry={refetch} />

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Wrench className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            {/*<p className="text-sm text-muted-foreground">*/}
            {/*  {myTeam ? myTeam.name : 'Support Engineer'}*/}
            {/*  /!*{teamLead && <> · Reporting to <span className="font-medium text-foreground">{teamLead.name}</span></>}*!/*/}
            {/*  /!*{unreadCount > 0 && (*!/*/}
            {/*  /!*  <span className="ml-2 inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">*!/*/}
            {/*  /!*    {unreadCount} new*!/*/}
            {/*  /!*  </span>*!/*/}
            {/*  /!*)}*!/*/}
            {/*</p>*/}
          </div>
        </div>
        <Button onClick={() => setNewCaseOpen(true)}>
          <PlusCircle className="h-4 w-4" /> New Case
        </Button>
      </div>

      <NewCaseDialog open={newCaseOpen} onOpenChange={setNewCaseOpen} />

      {/* Current-year totals, certifications, satisfaction, solutions provided,
          weekly workhours & week-wise workload, queuing cases, case updates,
          and performance summary */}
      <EngineerWidgets />
    </div>
  )
}
