'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { StatCard } from '@/components/shared/stat-card'
import { CaseCard } from '@/components/shared/case-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NewCaseDialog } from '@/modules/cases/new-case-dialog'
import { Ticket, CheckCircle, Clock, PlusCircle } from 'lucide-react'
import type { Case } from '@/types'

export default function ClientDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }
  const [newCaseOpen, setNewCaseOpen] = useState(false)

  const { data: casesData, isLoading } = useQuery({
    queryKey: ['cases', 'client', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 50 }),
  })

  const cases = casesData?.items ?? []
  const open = cases.filter((c: Case) => !['closed', 'resolved', 'pending_closure'].includes(c.status))
  const resolved = cases.filter((c: Case) => ['resolved', 'closed', 'pending_closure'].includes(c.status))
  const inProgress = cases.filter((c: Case) => c.status === 'in_progress')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Cases</h1>
          <p className="text-sm text-muted-foreground">Track your support requests</p>
        </div>
        <Button onClick={() => setNewCaseOpen(true)}>
          <PlusCircle className="h-4 w-4" />
          New Case
        </Button>
      </div>

      <NewCaseDialog open={newCaseOpen} onOpenChange={setNewCaseOpen} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Open Cases" value={open.length} icon={Ticket} loading={isLoading} />
        <StatCard title="In Progress" value={inProgress.length} icon={Clock} iconColor="text-blue-500" loading={isLoading} />
        <StatCard title="Resolved" value={resolved.length} icon={CheckCircle} iconColor="text-emerald-500" loading={isLoading} />
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Recent Cases</h2>
        <ScrollArea className="h-[440px] pr-2">
          <div className="space-y-3">
            {cases.length === 0 && !isLoading ? (
              <EmptyState
                icon={Ticket}
                title="No cases yet"
                description="Submit a new support case when you need help."
                action={{ label: 'Create Case', onClick: () => setNewCaseOpen(true) }}
              />
            ) : (
              cases.slice(0, 20).map((c: Case) => (
                <CaseCard key={c.id} case_={c} href={`/cases/${c.id}`} />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
