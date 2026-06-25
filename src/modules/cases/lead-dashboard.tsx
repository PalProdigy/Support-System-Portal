'use client'

import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { StatCard } from '@/components/shared/stat-card'
import { CaseCard } from '@/components/shared/case-card'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Ticket, AlertTriangle, CheckCircle, Users, PlusCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Case, Client, User } from '@/types'

export default function LeadDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesData, isLoading, error, refetch } = useQuery({
    queryKey: ['cases', 'lead', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 50 }),
  })

  const { data: clients } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => dp.listUsers(),
  })

  const cases = casesData?.items ?? []
  const clientsMap = Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c]))
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))

  const open = cases.filter((c: Case) => !['closed', 'resolved', 'pending_closure'].includes(c.status))
  const escalated = cases.filter((c: Case) => c.is_escalated)
  const unassigned = cases.filter((c: Case) => !c.assignee_id && !['closed', 'resolved'].includes(c.status))
  const resolved = cases.filter((c: Case) => ['resolved', 'closed'].includes(c.status))

  if (error) return <ErrorState onRetry={refetch} />

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your team&apos;s case queue</p>
        </div>
        <Button onClick={() => router.push('/cases/new')}>
          <PlusCircle className="h-4 w-4" />
          New Case
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Open" value={open.length} icon={Ticket} loading={isLoading} />
        <StatCard title="Unassigned" value={unassigned.length} icon={Users} iconColor="text-violet-500" loading={isLoading} />
        <StatCard title="Escalated" value={escalated.length} icon={AlertTriangle} iconColor="text-red-500" loading={isLoading} />
        <StatCard title="Resolved" value={resolved.length} icon={CheckCircle} iconColor="text-emerald-500" loading={isLoading} />
      </div>

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open ({open.length})</TabsTrigger>
          <TabsTrigger value="unassigned">Unassigned ({unassigned.length})</TabsTrigger>
          <TabsTrigger value="escalated">Escalated ({escalated.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="mt-4">
          <ScrollArea className="h-[460px] pr-2">
            <div className="space-y-3">
              {open.length === 0 ? (
                <EmptyState icon={CheckCircle} title="No open cases" />
              ) : (
                open.map((c: Case) => (
                  <CaseCard
                    key={c.id}
                    case_={c}
                    client={clientsMap[c.client_id]}
                    assignee={c.assignee_id ? usersMap[c.assignee_id] : undefined}
                    href={`/cases/${c.id}`}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="unassigned" className="mt-4">
          <ScrollArea className="h-[460px] pr-2">
            <div className="space-y-3">
              {unassigned.length === 0 ? (
                <EmptyState icon={CheckCircle} title="All cases assigned" />
              ) : (
                unassigned.map((c: Case) => (
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
        </TabsContent>
        <TabsContent value="escalated" className="mt-4">
          <ScrollArea className="h-[460px] pr-2">
            <div className="space-y-3">
              {escalated.length === 0 ? (
                <EmptyState icon={AlertTriangle} title="No escalated cases" />
              ) : (
                escalated.map((c: Case) => (
                  <CaseCard
                    key={c.id}
                    case_={c}
                    client={clientsMap[c.client_id]}
                    assignee={c.assignee_id ? usersMap[c.assignee_id] : undefined}
                    href={`/cases/${c.id}`}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}