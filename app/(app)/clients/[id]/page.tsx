'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { CaseCard } from '@/components/shared/case-card'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Building2, Phone, Ticket, CheckCircle2, AlertTriangle, Clock, Loader2 } from 'lucide-react'
import type { Case, ClientSolution, Solution } from '@/types'
import { formatDateTime, cn } from '@/lib/utils'
import { PreSalesNotesPanel } from '@/modules/sales-executive/pre-sales-notes'

const STATUS_COLORS: Record<string, { badge: string; label: string }> = {
  active: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', label: 'Active' },
  at_risk: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', label: 'At Risk' },
  churned: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', label: 'Churned' },
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const { data: client, isLoading: loadingClient, error, refetch } = useQuery({
    queryKey: ['client', id],
    queryFn: () => dp.getClient(id),
  })

  const { data: casesPage, isLoading: loadingCases } = useQuery({
    queryKey: ['cases', session.userId, { client_id: id }],
    queryFn: () => dp.listCases(scope, { client_id: id, pageSize: 50 }),
    enabled: !!client,
  })

  const { data: allClientSolutions } = useQuery({
    queryKey: ['client-solutions'],
    queryFn: () => dp.listClientSolutions(),
    enabled: !!client,
  })

  const { data: solutions } = useQuery({
    queryKey: ['solutions'],
    queryFn: () => dp.listSolutions(),
    enabled: !!client,
  })

  if (loadingClient) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )

  if (error || !client) return <ErrorState message="Client not found or access denied." onRetry={refetch} />

  const cases = casesPage?.items ?? []
  const clientSolutions = (allClientSolutions ?? []).filter((cs: ClientSolution) => cs.client_id === id)
  const solutionsMap = Object.fromEntries((solutions ?? []).map((s) => [s.id, s]))

  const openCases = cases.filter((c: Case) => !['closed', 'resolved', 'pending_closure'].includes(c.status))
  const criticalCases = cases.filter((c: Case) => c.priority === 'critical' && !['closed'].includes(c.status))
  const escalatedCases = cases.filter((c: Case) => c.is_escalated && !['closed'].includes(c.status))
  const resolvedCases = cases.filter((c: Case) => ['resolved', 'closed', 'pending_closure'].includes(c.status))

  const status = client.account_status || 'active'
  const statusConfig = STATUS_COLORS[status] || STATUS_COLORS.active

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Client header */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="rounded-xl bg-primary/10 p-3">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold">{client.company_name}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />{client.contact_person}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />{client.phone}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Client since {formatDateTime(client.created_at)}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={cn('text-sm', statusConfig.badge)}>
              {statusConfig.label}
            </Badge>
            {client.account_tier && (
              <Badge variant="outline" className="text-xs capitalize">{client.account_tier}</Badge>
            )}
          </div>
        </div>
        {client.industry && (
          <p className="text-sm text-muted-foreground">Industry: <span className="font-medium text-foreground">{client.industry}</span></p>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Ticket, title: 'Open', value: openCases.length },
          { icon: AlertTriangle, title: 'Critical', value: criticalCases.length },
          { icon: Clock, title: 'Escalated', value: escalatedCases.length },
          { icon: CheckCircle2, title: 'Resolved', value: resolvedCases.length },
        ].map(({ icon: Icon, title, value }) => (
          <div key={title} className="rounded-xl border bg-card p-4 flex items-center gap-3">
            {loadingCases ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <>
                <div className="rounded-lg bg-primary/10 p-2"><Icon className="h-4 w-4 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">{title}</p>
                  <p className="text-xl font-bold tabular-nums">{value}</p>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Cases */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Active Cases</h2>
          {loadingCases ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
          ) : openCases.length === 0 ? (
            <EmptyState icon={Ticket} title="No open cases" description="This client has no active support cases." />
          ) : (
            <div className="space-y-3">
              {openCases.map((c: Case) => (
                <CaseCard key={c.id} case_={c} href={`/cases/${c.id}`} />
              ))}
            </div>
          )}

          {resolvedCases.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-foreground pt-2">Resolved / Closed</h2>
              <div className="space-y-3">
                {resolvedCases.slice(0, 5).map((c: Case) => (
                  <CaseCard key={c.id} case_={c} href={`/cases/${c.id}`} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Solutions</h3>
            {clientSolutions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No solutions mapped.</p>
            ) : (
              <div className="space-y-2">
                {clientSolutions.map((cs: ClientSolution) => {
                  const sol = solutionsMap[cs.solution_id] as Solution | undefined
                  return (
                    <div key={cs.id} className="flex items-center gap-2">
                      <span className="text-sm">{sol?.name ?? cs.solution_id}</span>
                      <Badge variant="secondary" className="text-[10px] ml-auto">Active</Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Contact Details</h3>
            <div className="text-sm space-y-1.5">
              <p><span className="text-muted-foreground">Contact:</span> {client.contact_person}</p>
              <p><span className="text-muted-foreground">Phone:</span> {client.phone}</p>
              {client.email && (
                <p><span className="text-muted-foreground">Email:</span> {client.email}</p>
              )}
              <p><span className="text-muted-foreground">Notes:</span> {client.business_context}</p>
            </div>
          </div>

          <PreSalesNotesPanel clientId={id} />
        </div>
      </div>
    </div>
  )
}