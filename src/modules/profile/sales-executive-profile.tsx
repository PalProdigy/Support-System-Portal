'use client'

import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { StaffProfile, type StatItem } from './staff-profile'
import { isOpen, isDone } from './case-stats'
import { Building2, Target, Briefcase, ShieldAlert, Ticket, CheckCircle2, Trophy } from 'lucide-react'
import type { Case, Client, Prospect, User } from '@/types'

export function SalesExecutiveProfile({ user, teamName }: { user: User; teamName?: string }) {
  const dp = getDataProvider()
  const scope = { userId: user.id, role: user.role }

  const { data: clients } = useQuery({ queryKey: ['clients', user.id], queryFn: () => dp.listClients(scope) })
  const { data: prospects } = useQuery({ queryKey: ['prospects', user.id], queryFn: () => dp.listProspects(scope) })
  const { data: casesPage } = useQuery({ queryKey: ['cases', 'am-profile', user.id], queryFn: () => dp.listCases(scope, { pageSize: 500 }) })

  const clientList: Client[] = clients ?? []
  const prospectList: Prospect[] = prospects ?? []
  const cases: Case[] = casesPage?.items ?? []

  const openPipeline = prospectList.filter((p) => !['closed_won', 'closed_lost'].includes(p.stage)).length
  const won = prospectList.filter((p) => p.stage === 'closed_won').length
  const atRisk = clientList.filter((c) => c.account_status === 'at_risk').length

  const stats: StatItem[] = [
    { icon: <Building2 className="h-3.5 w-3.5 text-blue-500" />, label: 'Managed Clients', value: String(clientList.length) },
    { icon: <Target className="h-3.5 w-3.5 text-violet-500" />, label: 'Open Pipeline', value: String(openPipeline) },
    { icon: <Trophy className="h-3.5 w-3.5 text-amber-500" />, label: 'Won Deals', value: String(won) },
    { icon: <Briefcase className="h-3.5 w-3.5 text-slate-400" />, label: 'Total Prospects', value: String(prospectList.length) },
    { icon: <ShieldAlert className="h-3.5 w-3.5 text-red-500" />, label: 'At-Risk Clients', value: String(atRisk) },
    { icon: <Ticket className="h-3.5 w-3.5 text-blue-400" />, label: 'Client Cases', value: String(cases.length) },
    { icon: <Ticket className="h-3.5 w-3.5 text-slate-400" />, label: 'Open Cases', value: String(cases.filter(isOpen).length) },
    { icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />, label: 'Resolved', value: String(cases.filter(isDone).length) },
  ]

  return <StaffProfile user={user} teamName={teamName} stats={stats} summaryTitle="Sales Summary" />
}