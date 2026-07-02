'use client'

import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { StatCard } from '@/components/shared/stat-card'
import { SLABreachWidget } from '@/components/shared/sla-breach-widget'
import { CaseCard } from '@/components/shared/case-card'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Ticket, Building2, CheckCircle, AlertTriangle, PlusCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Case, Client } from '@/types'

export default function AMDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesData, isLoading: casesLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['cases', 'am', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 50 }),
  })

  const { data: clients } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
  })

  const cases = casesData?.items ?? []
  const clientsMap = Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c]))

  const open = cases.filter((c: Case) => !['closed', 'resolved', 'pending_closure'].includes(c.status))
  const escalated = cases.filter((c: Case) => c.is_escalated)
  const resolved = cases.filter((c: Case) => ['resolved', 'closed'].includes(c.status))

  if (error) return <ErrorState onRetry={refetch} />

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Account Overview</h1>
          <p className="text-sm text-muted-foreground">Your clients & their cases</p>
        </div>
        <Button onClick={() => router.push('/cases/new')}>
          <PlusCircle className="h-4 w-4" />
          New Case
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="My Clients" value={clients?.length ?? 0} icon={Building2} />
        <StatCard title="Open Cases" value={open.length} icon={Ticket} loading={casesLoading} />
        <StatCard title="Escalated" value={escalated.length} icon={AlertTriangle} iconColor="text-amber-500" loading={casesLoading} />
        <StatCard title="Resolved" value={resolved.length} icon={CheckCircle} iconColor="text-emerald-500" loading={casesLoading} />
      </div>

      {/* SLA Breach Widget */}
      <SLABreachWidget cases={cases} isLoading={casesLoading} onRefresh={() => refetch()} />

      {/* Clients overview */}
      {clients && clients.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3">Clients</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clients.map((c: Client) => {
              const clientCases = cases.filter((x: Case) => x.client_id === c.id)
              const openCount = clientCases.filter((x: Case) => !['closed', 'resolved'].includes(x.status)).length
              return (
                <div
                  key={c.id}
                  className="rounded-xl border bg-card p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/clients/${c.id}`)}
                >
                  <p className="font-semibold text-sm text-foreground">{c.company_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.contact_person}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <span className="text-foreground">{openCount} open cases</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{clientCases.length} total</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent cases */}
      <div>
        <h2 className="text-base font-semibold mb-3">Recent Cases</h2>
        <ScrollArea className="h-[300px] pr-2">
          <div className="space-y-3">
            {cases.length === 0 ? (
              <EmptyState icon={Ticket} title="No cases" description="No cases for your clients yet." />
            ) : (
              cases.slice(0, 10).map((c: Case) => (
                <CaseCard
                  key={c.id}
                  case_={c}
                  client={clientsMap[c.client_id]}
                  href={`/cases/${c.id}`}
                  compact
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}