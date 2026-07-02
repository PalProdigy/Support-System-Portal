'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProfileHeader, KpiCard, InfoCard, InfoRow } from './shared'
import { Ticket, CheckCircle2, Clock, Building2, Package, Phone, ExternalLink } from 'lucide-react'
import type { Case, Client, ClientSolution, Solution, User } from '@/types'

const TIER_LABELS: Record<NonNullable<Client['account_tier']>, string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
}

export function ClientProfile({ user }: { user: User }) {
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: user.id, role: user.role }

  const { data: clients } = useQuery({ queryKey: ['clients', user.id], queryFn: () => dp.listClients(scope) })
  const client: Client | undefined = (clients ?? [])[0]

  const { data: casesPage } = useQuery({
    queryKey: ['cases', 'client-profile', user.id],
    queryFn: () => dp.listCases(scope, { pageSize: 500 }),
  })
  const { data: clientSolutions } = useQuery({
    queryKey: ['client-solutions', client?.id],
    queryFn: () => dp.listClientSolutions(client!.id),
    enabled: !!client,
  })
  const { data: solutions } = useQuery({ queryKey: ['solutions'], queryFn: () => dp.listSolutions() })

  const cases: Case[] = casesPage?.items ?? []
  const openCases = cases.filter((c) => !['resolved', 'pending_closure', 'closed'].includes(c.status))
  const closedCases = cases.filter((c) => ['closed', 'pending_closure'].includes(c.status))

  const solutionsMap = Object.fromEntries((solutions ?? []).map((s: Solution) => [s.id, s]))
  const subscribedNames = (clientSolutions ?? [])
    .map((cs: ClientSolution) => solutionsMap[cs.solution_id]?.name)
    .filter(Boolean) as string[]

  return (
    <>
      <ProfileHeader
        user={user}
        badges={
          <>
            {client?.account_tier && <Badge variant="outline">{TIER_LABELS[client.account_tier]}</Badge>}
            {client?.account_status && (
              <Badge variant={client.account_status === 'active' ? 'default' : 'destructive'}>
                {client.account_status === 'active' ? 'Active' : client.account_status === 'at_risk' ? 'At Risk' : 'Churned'}
              </Badge>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard icon={<Ticket className="h-5 w-5 text-blue-500" />} label="Total Cases" value={String(cases.length)} />
        <KpiCard icon={<Clock className="h-5 w-5 text-slate-400" />} label="Open Cases" value={String(openCases.length)} />
        <KpiCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} label="Closed" value={String(closedCases.length)} />
        <KpiCard icon={<Package className="h-5 w-5 text-violet-500" />} label="Solutions" value={String(subscribedNames.length)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InfoCard title="Company" icon={<Building2 className="h-3.5 w-3.5" />}>
          {client ? (
            <>
              <InfoRow label="Company" value={client.company_name} />
              <InfoRow label="Contact" value={client.contact_person} />
              <InfoRow label="Phone" value={<span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {client.phone}</span>} />
              {client.industry && <InfoRow label="Industry" value={client.industry} />}
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => router.push('/client')}>
                <ExternalLink className="h-3 w-3" /> Open My Portal
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No company profile linked to this account.</p>
          )}
        </InfoCard>

        <InfoCard title="Subscribed Solutions" icon={<Package className="h-3.5 w-3.5" />}>
          {subscribedNames.length === 0 ? (
            <p className="text-sm text-muted-foreground">No solutions subscribed yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subscribedNames.map((name) => (
                <Badge key={name} variant="secondary">{name}</Badge>
              ))}
            </div>
          )}
        </InfoCard>
      </div>
    </>
  )
}
