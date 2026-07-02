'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { ProfileHeader, KpiCard, InfoCard, InfoRow } from './shared'
import { Building2, Briefcase, Target, TrendingUp, ExternalLink } from 'lucide-react'
import type { Client, Prospect, ProspectStage, User } from '@/types'

const STAGE_LABELS: Record<ProspectStage, string> = {
  discovery: 'Discovery',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

export function SalesExecutiveProfile({ user }: { user: User }) {
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: user.id, role: user.role }

  const { data: clients } = useQuery({ queryKey: ['clients', user.id], queryFn: () => dp.listClients(scope) })
  const { data: prospects } = useQuery({ queryKey: ['prospects', user.id], queryFn: () => dp.listProspects(scope) })

  const clientList: Client[] = clients ?? []
  const prospectList: Prospect[] = prospects ?? []
  const openPipeline = prospectList.filter((p) => !['closed_won', 'closed_lost'].includes(p.stage))
  const won = prospectList.filter((p) => p.stage === 'closed_won')

  // Count prospects per stage for the pipeline breakdown.
  const stageCounts = (Object.keys(STAGE_LABELS) as ProspectStage[]).map((stage) => ({
    stage,
    count: prospectList.filter((p) => p.stage === stage).length,
  }))

  return (
    <>
      <ProfileHeader user={user} badges={<span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Briefcase className="h-3.5 w-3.5" /> Account Manager</span>} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard icon={<Building2 className="h-5 w-5 text-blue-500" />} label="Managed Clients" value={String(clientList.length)} />
        <KpiCard icon={<Target className="h-5 w-5 text-violet-500" />} label="Open Pipeline" value={String(openPipeline.length)} />
        <KpiCard icon={<TrendingUp className="h-5 w-5 text-emerald-500" />} label="Won Deals" value={String(won.length)} />
        <KpiCard icon={<Briefcase className="h-5 w-5 text-slate-400" />} label="Total Prospects" value={String(prospectList.length)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InfoCard title="Pipeline by Stage" icon={<Target className="h-3.5 w-3.5" />}>
          {prospectList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No prospects yet.</p>
          ) : (
            <>
              {stageCounts.map(({ stage, count }) => (
                <InfoRow key={stage} label={STAGE_LABELS[stage]} value={String(count)} />
              ))}
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => router.push('/sales-executive')}>
                <ExternalLink className="h-3 w-3" /> Open AM Hub
              </Button>
            </>
          )}
        </InfoCard>

        <InfoCard title="Recent Clients" icon={<Building2 className="h-3.5 w-3.5" />}>
          {clientList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clients assigned yet.</p>
          ) : (
            <div className="space-y-1.5">
              {clientList.slice(0, 6).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-foreground truncate">{c.company_name}</span>
                  <span className="text-xs text-muted-foreground truncate">{c.contact_person}</span>
                </div>
              ))}
            </div>
          )}
        </InfoCard>
      </div>
    </>
  )
}
