'use client'

import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { StaffProfile, type StatItem } from './staff-profile'
import { isOpen, isDone, isEscalated, avgRating, pointsForCases } from './case-stats'
import { formatDuration } from '@/lib/utils'
import {
  Ticket, CheckCircle2, Clock, Star, RotateCcw, AlertTriangle, Trophy, Users,
} from 'lucide-react'
import type { Case, Feedback, User } from '@/types'

export function StaffProfileWrapper({ user, teamName }: { user: User; teamName?: string }) {
  const dp = getDataProvider()
  const scope = { userId: user.id, role: user.role }

  if (user.role === 'support_engineer') {
    const { data: metrics } = useQuery({
      queryKey: ['engineer-metrics', user.id],
      queryFn: () => dp.getEngineerMetrics(user.id, scope),
    })
    const { data: casesPage } = useQuery({
      queryKey: ['cases-by-engineer', user.id],
      queryFn: () => dp.listCases(scope, { assignee_id: user.id, pageSize: 500 }),
    })

    const cases: Case[] = casesPage?.items ?? []
    const reopened = cases.filter((c) => c.reopened_from_case_id).length
    const escalated = cases.filter((c) => c.is_escalated || c.status === 'escalated').length

    const stats: StatItem[] = [
      { icon: <Trophy className="h-3.5 w-3.5 text-amber-500" />, label: 'Points', value: String(metrics?.points ?? 0) },
      { icon: <Ticket className="h-3.5 w-3.5 text-blue-500" />, label: 'Cases Assigned', value: String(cases.length) },
      { icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />, label: 'Cases Resolved', value: String(metrics?.total_resolved ?? 0) },
      { icon: <Ticket className="h-3.5 w-3.5 text-slate-400" />, label: 'Open Cases', value: String(metrics?.open_cases ?? 0) },
      { icon: <Clock className="h-3.5 w-3.5 text-blue-400" />, label: 'Avg Resolution', value: metrics?.avg_resolution_hours != null ? formatDuration(metrics.avg_resolution_hours * 3_600_000) : '—' },
      { icon: <Star className="h-3.5 w-3.5 text-yellow-500" />, label: 'Customer Rating', value: metrics?.satisfaction_score != null ? `${metrics.satisfaction_score.toFixed(1)}/5` : '—' },
      { icon: <RotateCcw className="h-3.5 w-3.5 text-amber-500" />, label: 'Reopen Cases', value: String(reopened) },
      { icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />, label: 'Escalated', value: String(escalated) },
    ]

    return <StaffProfile user={user} teamName={teamName} stats={stats} points={metrics?.points ?? 0} />
  }

  if (user.role === 'team_lead') {
    const { data: casesPage } = useQuery({ queryKey: ['cases', 'lead-profile', user.id], queryFn: () => dp.listCases(scope, { pageSize: 500 }) })
    const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
    const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
    const { data: feedback } = useQuery({ queryKey: ['feedback', 'lead-profile', user.id], queryFn: () => dp.listFeedback(scope) })

    const cases: Case[] = casesPage?.items ?? []
    const fb: Feedback[] = feedback ?? []
    const ledTeam = (teams ?? []).find((t) => t.lead_user_id === user.id)
    const members = (users ?? []).filter((u) => u.team_id === ledTeam?.id && u.id !== user.id).length
    const reopened = cases.filter((c) => c.reopened_from_case_id).length
    const rating = avgRating(fb)

    const stats: StatItem[] = [
      { icon: <Ticket className="h-3.5 w-3.5 text-blue-500" />, label: 'Team Cases', value: String(cases.length) },
      { icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />, label: 'Resolved', value: String(cases.filter(isDone).length) },
      { icon: <Ticket className="h-3.5 w-3.5 text-slate-400" />, label: 'Open Cases', value: String(cases.filter(isOpen).length) },
      { icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />, label: 'Escalated', value: String(cases.filter(isEscalated).length) },
      { icon: <Star className="h-3.5 w-3.5 text-yellow-500" />, label: 'Avg Rating', value: rating != null ? `${rating.toFixed(1)}/5` : '—' },
      { icon: <RotateCcw className="h-3.5 w-3.5 text-amber-500" />, label: 'Reopen Cases', value: String(reopened) },
      { icon: <Users className="h-3.5 w-3.5 text-violet-500" />, label: 'Team Members', value: String(members) },
    ]

    return <StaffProfile user={user} teamName={teamName ?? ledTeam?.name} stats={stats} summaryTitle="Team Summary" points={pointsForCases(cases.filter(isDone))} />
  }

  return null
}
