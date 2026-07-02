'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { ProfileHeader, KpiCard, InfoCard, InfoRow } from './shared'
import { Ticket, AlertTriangle, Users, Wrench, Headset, ShieldAlert, ExternalLink } from 'lucide-react'
import type { Case, User } from '@/types'

export function TechnicalHeadProfile({ user }: { user: User }) {
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: user.id, role: user.role }

  const { data: casesPage } = useQuery({
    queryKey: ['cases', 'th-profile'],
    queryFn: () => dp.listCases(scope, { pageSize: 500 }),
  })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })

  const cases: Case[] = casesPage?.items ?? []
  const openCases = cases.filter((c) => !['resolved', 'pending_closure', 'closed'].includes(c.status))
  const escalated = cases.filter((c) => c.is_escalated || c.status === 'escalated')
  const engineers = (users ?? []).filter((u) => u.role === 'support_engineer')
  const leads = (users ?? []).filter((u) => u.role === 'team_lead')

  return (
    <>
      <ProfileHeader user={user} badges={<span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ShieldAlert className="h-3.5 w-3.5" /> Organization-wide oversight</span>} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard icon={<Ticket className="h-5 w-5 text-blue-500" />} label="Total Cases" value={String(cases.length)} />
        <KpiCard icon={<Ticket className="h-5 w-5 text-slate-400" />} label="Open Now" value={String(openCases.length)} />
        <KpiCard icon={<AlertTriangle className="h-5 w-5 text-red-500" />} label="Escalated" value={String(escalated.length)} />
        <KpiCard icon={<Headset className="h-5 w-5 text-violet-500" />} label="Teams" value={String((teams ?? []).length)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InfoCard title="Workforce" icon={<Users className="h-3.5 w-3.5" />}>
          <InfoRow label="Support Engineers" value={String(engineers.length)} />
          <InfoRow label="Team Leads" value={String(leads.length)} />
          <InfoRow label="Total Users" value={String((users ?? []).length)} />
          <div className="pt-1 flex gap-2">
            <Button size="sm" variant="outline" className="h-8" onClick={() => router.push('/support-engineer')}>
              <Wrench className="h-3.5 w-3.5" /> Engineers
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => router.push('/team-lead')}>
              <Users className="h-3.5 w-3.5" /> Team Leads
            </Button>
          </div>
        </InfoCard>

        <InfoCard title="Teams" icon={<Headset className="h-3.5 w-3.5" />}>
          {(teams ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams yet.</p>
          ) : (
            <div className="space-y-1.5">
              {(teams ?? []).map((t) => {
                const lead = (users ?? []).find((u) => u.id === t.lead_user_id)
                return (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-foreground truncate">{t.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{lead?.name ?? 'No lead'}</span>
                  </div>
                )
              })}
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs mt-1" onClick={() => router.push('/technical-head')}>
                <ExternalLink className="h-3 w-3" /> Open TH Hub
              </Button>
            </div>
          )}
        </InfoCard>
      </div>
    </>
  )
}
