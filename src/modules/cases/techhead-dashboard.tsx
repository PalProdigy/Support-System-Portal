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
import { Ticket, AlertTriangle, CheckCircle, Clock, Users } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { Case, User, Client, AuditLog } from '@/types'

export default function TechHeadDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesData, isLoading: casesLoading, error: casesError, refetch } = useQuery({
    queryKey: ['cases', 'all', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 50 }),
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => dp.listUsers(),
  })

  const { data: clients } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
  })

  const { data: auditLogs } = useQuery({
    queryKey: ['audit-logs', 'recent'],
    queryFn: () => dp.listAuditLogs({ limit: 10 }),
  })

  const cases = casesData?.items ?? []
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))
  const clientsMap = Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c]))

  const openCases = cases.filter((c) => !['closed', 'resolved'].includes(c.status))
  const escalated = cases.filter((c) => c.is_escalated)
  const resolved = cases.filter((c) => c.status === 'resolved' || c.status === 'closed')
  const critical = cases.filter((c) => c.priority === 'critical' && !['closed', 'resolved'].includes(c.status))

  if (casesError) return <ErrorState onRetry={refetch} />

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All cases · all teams · full visibility</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Open Cases" value={openCases.length} icon={Ticket} loading={casesLoading} />
        <StatCard title="Critical" value={critical.length} icon={AlertTriangle} iconColor="text-red-500" loading={casesLoading} />
        <StatCard title="Escalated" value={escalated.length} icon={AlertTriangle} iconColor="text-amber-500" loading={casesLoading} />
        <StatCard title="Resolved" value={resolved.length} icon={CheckCircle} iconColor="text-emerald-500" loading={casesLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Case list */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="open">
            <TabsList className="mb-4">
              <TabsTrigger value="open">Open ({openCases.length})</TabsTrigger>
              <TabsTrigger value="escalated">Escalated ({escalated.length})</TabsTrigger>
              <TabsTrigger value="critical">Critical ({critical.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="open">
              <ScrollArea className="h-[460px] pr-2">
                <div className="space-y-3">
                  {openCases.length === 0 ? (
                    <EmptyState icon={Ticket} title="No open cases" description="All cases are resolved or closed." />
                  ) : (
                    openCases.slice(0, 15).map((c: Case) => (
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
            <TabsContent value="escalated">
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
            <TabsContent value="critical">
              <ScrollArea className="h-[460px] pr-2">
                <div className="space-y-3">
                  {critical.length === 0 ? (
                    <EmptyState icon={CheckCircle} title="No critical cases" />
                  ) : (
                    critical.map((c: Case) => (
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

        {/* Side panels */}
        <div className="space-y-4">
          {/* Team stats */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Staff Summary</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Users</span>
                <span className="font-medium">{users?.length ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active</span>
                <span className="font-medium">{users?.filter((u: User) => u.is_active).length ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Clients</span>
                <span className="font-medium">{clients?.length ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Recent Audit Logs */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Recent Activity</h3>
            </div>
            <div className="space-y-2.5">
              {(auditLogs ?? []).slice(0, 6).map((log: AuditLog) => (
                <div key={log.id} className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 mt-0.5">
                    {formatDateTime(log.created_at).split(',')[0]}
                  </span>
                  <span className="text-foreground line-clamp-1">
                    {log.action} {log.entity_type} {log.entity_id.slice(0, 6)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
