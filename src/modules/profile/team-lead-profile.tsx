'use client'

import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { StaffProfile, type StatItem } from './staff-profile'
import { isOpen, isDone, isEscalated, slaCompliancePct, avgRating } from './case-stats'
import { Ticket, CheckCircle2, AlertTriangle, TrendingUp, Star, RotateCcw, Users } from 'lucide-react'
import type { Case, Feedback, User } from '@/types'

export function TeamLeadProfile({ user, teamName }: { user: User; teamName?: string }) {
  const dp = getDataProvider()
  const scope = { userId: user.id, role: user.role }

  // team_lead scope returns only this lead's team cases.
  const { data: casesPage } = useQuery({ queryKey: ['cases', 'lead-profile', user.id], queryFn: () => dp.listCases(scope, { pageSize: 500 }) })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
  const { data: feedback } = useQuery({ queryKey: ['feedback', 'lead-profile', user.id], queryFn: () => dp.listFeedback(scope) })

  const cases: Case[] = casesPage?.items ?? []
  const fb: Feedback[] = feedback ?? []
  const ledTeam = (teams ?? []).find((t) => t.lead_user_id === user.id)
  const members = (users ?? []).filter((u) => u.team_id === ledTeam?.id && u.id !== user.id).length
  const reopened = cases.filter((c) => c.reopened_from_case_id).length
  const sla = slaCompliancePct(cases)
  const rating = avgRating(fb)

  const stats: StatItem[] = [
    { icon: <Ticket className="h-3.5 w-3.5 text-blue-500" />, label: 'Team Cases', value: String(cases.length) },
    { icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />, label: 'Resolved', value: String(cases.filter(isDone).length) },
    { icon: <Ticket className="h-3.5 w-3.5 text-slate-400" />, label: 'Open Cases', value: String(cases.filter(isOpen).length) },
    { icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />, label: 'Escalated', value: String(cases.filter(isEscalated).length) },
    { icon: <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />, label: 'SLA Compliance', value: sla != null ? `${sla.toFixed(0)}%` : '—' },
    { icon: <Star className="h-3.5 w-3.5 text-yellow-500" />, label: 'Avg Rating', value: rating != null ? `${rating.toFixed(1)}/5` : '—' },
    { icon: <RotateCcw className="h-3.5 w-3.5 text-amber-500" />, label: 'Reopen Cases', value: String(reopened) },
    { icon: <Users className="h-3.5 w-3.5 text-violet-500" />, label: 'Team Members', value: String(members) },
  ]

  return <StaffProfile user={user} teamName={teamName ?? ledTeam?.name} stats={stats} summaryTitle="Team Summary" />
}