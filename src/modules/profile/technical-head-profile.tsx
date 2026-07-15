'use client'

import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { StaffProfile, type StatItem } from './staff-profile'
import { isOpen, isDone, isEscalated, slaCompliancePct, avgRating, pointsForCases } from './case-stats'
import { Ticket, CheckCircle2, AlertTriangle, TrendingUp, Star, Headset, Wrench } from 'lucide-react'
import type { Case, Feedback, User } from '@/types'

export function TechnicalHeadProfile({ user, teamName }: { user: User; teamName?: string }) {
  const dp = getDataProvider()
  const scope = { userId: user.id, role: user.role }

  const { data: casesPage } = useQuery({ queryKey: ['cases', 'th-profile'], queryFn: () => dp.listCases(scope, { pageSize: 500 }) })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
  const { data: feedback } = useQuery({ queryKey: ['feedback', 'th-profile'], queryFn: () => dp.listFeedback(scope) })

  const cases: Case[] = casesPage?.items ?? []
  const fb: Feedback[] = feedback ?? []
  const engineers = (users ?? []).filter((u) => u.role === 'support_engineer').length
  const sla = slaCompliancePct(cases)
  const rating = avgRating(fb)

  const stats: StatItem[] = [
    { icon: <Ticket className="h-3.5 w-3.5 text-blue-500" />, label: 'Total Cases', value: String(cases.length) },
    { icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />, label: 'Resolved', value: String(cases.filter(isDone).length) },
    { icon: <Ticket className="h-3.5 w-3.5 text-slate-400" />, label: 'Open Cases', value: String(cases.filter(isOpen).length) },
    { icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />, label: 'Escalated', value: String(cases.filter(isEscalated).length) },
    { icon: <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />, label: 'SLA Compliance', value: sla != null ? `${sla.toFixed(0)}%` : '—' },
    { icon: <Star className="h-3.5 w-3.5 text-yellow-500" />, label: 'Avg Rating', value: rating != null ? `${rating.toFixed(1)}/5` : '—' },
    { icon: <Headset className="h-3.5 w-3.5 text-violet-500" />, label: 'Teams', value: String((teams ?? []).length) },
    { icon: <Wrench className="h-3.5 w-3.5 text-blue-400" />, label: 'Engineers', value: String(engineers) },
  ]

  return <StaffProfile user={user} teamName={teamName} stats={stats} summaryTitle="Organization Summary" points={pointsForCases(cases.filter(isDone))} />
}