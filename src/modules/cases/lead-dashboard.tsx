'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { StatCard } from '@/components/shared/stat-card'
import { CaseCard } from '@/components/shared/case-card'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { cn, slaPercent } from '@/lib/utils'
import {
  Ticket, AlertTriangle, CheckCircle, Users, PlusCircle,
  Inbox, ClipboardCheck, ArrowRight, LayoutList, BarChart3, Bell, UserCheck,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Case, Client, User } from '@/types'

const OPEN_EXCLUDE = ['closed', 'resolved', 'pending_closure']

// Sample card shown in the Unassigned tab when there are no real unassigned cases.
const DEMO_UNASSIGNED_CASE: Case = {
  id: 'demo-unassigned',
  reference_no: 'NHQ-DEMO-001',
  title: 'Demo · Payment gateway returns 500 on checkout',
  description: 'Sample unassigned case for preview.',
  client_id: 'demo-client',
  solution_id: 'demo-solution',
  team_id: 'demo-team',
  priority: 'high',
  status: 'new',
  sla_rule_id: 'demo-sla',
  sla_due_at: '2026-06-28T17:00:00.000Z',
  escalation_level: 0,
  created_at: '2026-06-28T09:00:00.000Z',
  is_escalated: false,
}
const DEMO_CLIENT: Client = {
  id: 'demo-client',
  user_id: 'demo-user',
  company_name: 'Acme Corp (demo)',
  contact_person: 'Jane Doe',
  phone: '',
  business_context: '',
  created_by: 'demo',
  created_at: '2026-06-28T09:00:00.000Z',
}

export default function LeadDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesData, isLoading, error, refetch } = useQuery({
    queryKey: ['cases', 'lead', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 200 }),
  })

  const { data: clients } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => dp.listUsers(),
  })

  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => dp.listTeams(),
  })

  const { data: notifications } = useQuery({
    queryKey: ['notifications', session.userId],
    queryFn: () => dp.listNotifications(session.userId),
  })

  const cases = casesData?.items ?? []
  const clientsMap = Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c]))
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))

  const myUser = (users ?? []).find((u) => u.id === session.userId)
  const myTeam = (teams ?? []).find((t) => t.id === myUser?.team_id)

  const open = cases.filter((c: Case) => !OPEN_EXCLUDE.includes(c.status))
  const unassigned = cases.filter((c: Case) => !c.assignee_id && ['new', 'triaged'].includes(c.status))
  const assigned = cases.filter((c: Case) => c.status === 'in_progress')
  const escalated = cases.filter((c: Case) => c.status === 'escalated')
  const closed = cases.filter((c: Case) => c.status === 'closed')
  const resolved = cases.filter((c: Case) => ['resolved', 'closed'].includes(c.status))
  const pendingClosure = cases.filter((c: Case) => c.status === 'pending_closure')

  // Team workload snapshot — engineers in this lead's team, sorted by open load.
  const workload = (users ?? [])
    .filter((u) => u.role === 'support_engineer' && u.team_id === myUser?.team_id && u.is_active)
    .map((eng) => {
      const engOpen = open.filter((c) => c.assignee_id === eng.id)
      const critical = engOpen.filter((c) => c.priority === 'critical').length
      const breached = engOpen.filter((c) => slaPercent(c.created_at, c.sla_due_at) >= 100).length
      return { eng, open: engOpen.length, critical, breached }
    })
    .sort((a, b) => b.open - a.open)

  const maxLoad = Math.max(...workload.map((w) => w.open), 1)

  const unreadCount = (notifications ?? []).filter(
    (n) => !n.read_at && ['new_case', 'case_escalated', 'client_replied'].includes(n.type)
  ).length

  if (error) return <ErrorState onRetry={refetch} />

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Team Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {myTeam ? myTeam.name : 'Your team'} · {workload.length} engineer{workload.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push('/lead')}>
            <LayoutList className="h-4 w-4" />
            Lead Hub
          </Button>
          <Button onClick={() => router.push('/cases/new')}>
            <PlusCircle className="h-4 w-4" />
            New Case
          </Button>
        </div>
      </div>

      {/* KPIs — each deep-links into the relevant workspace */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatLink href="/lead">
          <StatCard title="Open" value={open.length} icon={Ticket} loading={isLoading} />
        </StatLink>
        <StatLink href="/lead?tab=queue">
          <StatCard title="Unassigned" value={unassigned.length}  icon={Inbox} iconColor="text-violet-500" loading={isLoading} />
        </StatLink>
        <StatLink href="/lead?tab=workload">
          <StatCard title="Assigned" value={assigned.length}  icon={UserCheck} iconColor="text-blue-500" loading={isLoading} />
        </StatLink>
        <StatLink href="/cases">
          <StatCard title="Escalated" value={escalated.length}  icon={AlertTriangle} iconColor="text-red-500" loading={isLoading} />
        </StatLink>
        <StatLink href="/lead?tab=closure">
          <StatCard title="Closed" value={closed.length}  icon={ClipboardCheck} iconColor="text-emerald-500" loading={isLoading} />
        </StatLink>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Needs Attention — action-focused queue (no overlap with full Cases list) */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold">Needs Attention</h2>
            <span className="text-xs text-muted-foreground">Items waiting on the team or you</span>
          </div>
          <Tabs defaultValue="unassigned">
            <TabsList>
              <TabsTrigger value="unassigned">Unassigned ({unassigned.length})</TabsTrigger>
              <TabsTrigger value="assigned">Assigned ({assigned.length})</TabsTrigger>
              <TabsTrigger value="escalated">Escalated ({escalated.length})</TabsTrigger>
              <TabsTrigger value="closed">Closed ({closed.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="unassigned" className="mt-4">
              <ScrollArea className="h-[440px] pr-2">
                <div className="space-y-3">
                  {unassigned.length === 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">No unassigned cases right now — showing a sample card:</p>
                      <CaseCard case_={DEMO_UNASSIGNED_CASE} client={DEMO_CLIENT} unassigned />
                    </div>
                  ) : (
                    unassigned.map((c: Case) => (
                      <CaseCard key={c.id} case_={c} client={clientsMap[c.client_id]} href={`/cases/${c.id}`} unassigned />
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="assigned" className="mt-4">
              <ScrollArea className="h-[440px] pr-2">
                <div className="space-y-3">
                  {assigned.length === 0 ? (
                    <EmptyState icon={UserCheck} title="No assigned cases" description="No open cases are currently assigned to an engineer." />
                  ) : (
                    assigned.map((c: Case) => (
                      <CaseCard key={c.id} case_={c} client={clientsMap[c.client_id]} assignee={c.assignee_id ? usersMap[c.assignee_id] : undefined} href={`/cases/${c.id}`} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="escalated" className="mt-4">
              <ScrollArea className="h-[440px] pr-2">
                <div className="space-y-3">
                  {escalated.length === 0 ? (
                    <EmptyState icon={AlertTriangle} title="No escalated cases" description="No cases need escalation handling." />
                  ) : (
                    escalated.map((c: Case) => (
                      <CaseCard key={c.id} case_={c} client={clientsMap[c.client_id]} assignee={c.assignee_id ? usersMap[c.assignee_id] : undefined} href={`/cases/${c.id}`} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="closed" className="mt-4">
              <ScrollArea className="h-[440px] pr-2">
                <div className="space-y-3">
                  {closed.length === 0 ? (
                    <EmptyState icon={CheckCircle} title="No closed cases" description="Closed cases will appear here." />
                  ) : (
                    closed.map((c: Case) => (
                      <CaseCard key={c.id} case_={c} client={clientsMap[c.client_id]} assignee={c.assignee_id ? usersMap[c.assignee_id] : undefined} href={`/cases/${c.id}`} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          {/* Team workload snapshot */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Team Workload</h3>
              </div>
              <Link href="/lead?tab=workload" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                Details <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {workload.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No engineers in this team.</p>
            ) : (
              <div className="space-y-3">
                {workload.slice(0, 6).map(({ eng, open: load, critical, breached }) => (
                  <Link key={eng.id} href={`/engineer/${eng.id}`} className="block group">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground truncate group-hover:text-primary">{eng.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {critical > 0 && (
                          <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" />{critical}
                          </span>
                        )}
                        {breached > 0 && (
                          <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">{breached} breach</span>
                        )}
                        <span className={cn('text-sm font-bold tabular-nums', load > 5 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>{load}</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', load === 0 ? 'bg-emerald-400' : load > 5 ? 'bg-red-500' : load > 2 ? 'bg-amber-500' : 'bg-primary')}
                        style={{ width: `${Math.round((load / maxLoad) * 100)}%` }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
            <div className="space-y-1">
              <QuickAction href="/lead?tab=closure" icon={ClipboardCheck} label="Closure Review" badge={pendingClosure.length} />
              <QuickAction href="/lead?tab=activity" icon={Bell} label="Team Activity" badge={unreadCount} />
              <QuickAction href="/cases" icon={Ticket} label="All Cases" />
              <QuickAction href="/reporting" icon={BarChart3} label="Reporting" />
            </div>
          </div>

          {/* Team health summary */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Team Health</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active cases</span>
                <span className="font-medium tabular-nums">{open.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Resolved / closed</span>
                <span className="font-medium tabular-nums">{resolved.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Clients served</span>
                <span className="font-medium tabular-nums">{clients?.length ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {children}
    </Link>
  )
}

function QuickAction({ href, icon: Icon, label, badge }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; badge?: number }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold h-5 min-w-5 px-1.5">
          {badge}
        </span>
      )}
      <ArrowRight className="h-3.5 w-3.5 opacity-50" />
    </Link>
  )
}
