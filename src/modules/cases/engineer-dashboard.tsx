'use client'

import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { StatCard } from '@/components/shared/stat-card'
import { CaseCard } from '@/components/shared/case-card'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { NewCases } from '@/modules/engineer/new-cases'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Ticket, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import type { Case, Client } from '@/types'

export default function EngineerDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesData, isLoading, error, refetch } = useQuery({
    queryKey: ['cases', 'engineer', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 50 }),
  })

  const { data: clients } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
  })

  const cases = casesData?.items ?? []
  const clientsMap = Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c]))

  const open = cases.filter((c: Case) => !['closed', 'resolved', 'pending_closure'].includes(c.status))
  const inProgress = cases.filter((c: Case) => c.status === 'in_progress')
  const pendingClient = cases.filter((c: Case) => c.status === 'pending_client')
  const resolved = cases.filter((c: Case) => ['resolved', 'closed', 'pending_closure'].includes(c.status))

  if (error) return <ErrorState onRetry={refetch} />

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Queue</h1>
        <p className="text-sm text-muted-foreground">Cases assigned to you</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Open" value={open.length} icon={Ticket} loading={isLoading} />
        <StatCard title="In Progress" value={inProgress.length} icon={Clock} iconColor="text-blue-500" loading={isLoading} />
        <StatCard title="Pending Client" value={pendingClient.length} icon={AlertTriangle} iconColor="text-amber-500" loading={isLoading} />
        <StatCard title="Resolved" value={resolved.length} icon={CheckCircle} iconColor="text-emerald-500" loading={isLoading} />
      </div>

      {/* Freshly routed, unassigned cases the engineer can request to take */}
      <NewCases clientsMap={clientsMap} />

      <div>
        <h2 className="text-base font-semibold mb-3">Active Cases ({open.length})</h2>
        <ScrollArea className="h-[460px] pr-2">
          <div className="space-y-3">
            {open.length === 0 && !isLoading ? (
              <EmptyState icon={CheckCircle} title="All caught up!" description="No open cases assigned to you." />
            ) : (
              open.map((c: Case) => (
                <CaseCard
                  key={c.id}
                  case_={c}
                  client={clientsMap[c.client_id]}
                  href={`/cases/${c.id}`}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
