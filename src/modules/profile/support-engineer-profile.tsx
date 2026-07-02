'use client'

import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { StaffProfile, type StatItem } from './staff-profile'
import { formatDuration } from '@/lib/utils'
import {
  Ticket, CheckCircle2, Clock, TrendingUp, Star, RotateCcw, AlertTriangle,
} from 'lucide-react'
import type { Case, User } from '@/types'

export function SupportEngineerProfile({ user, teamName }: { user: User; teamName?: string }) {
  const dp = getDataProvider()
  const scope = { userId: user.id, role: user.role }

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
    { icon: <Ticket className="h-3.5 w-3.5 text-blue-500" />, label: 'Cases Assigned', value: String(cases.length) },
    { icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />, label: 'Cases Resolved', value: String(metrics?.total_resolved ?? 0) },
    { icon: <Ticket className="h-3.5 w-3.5 text-slate-400" />, label: 'Open Cases', value: String(metrics?.open_cases ?? 0) },
    { icon: <Clock className="h-3.5 w-3.5 text-blue-400" />, label: 'Avg Resolution', value: metrics?.avg_resolution_hours != null ? formatDuration(metrics.avg_resolution_hours * 3_600_000) : '—' },
    { icon: <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />, label: 'SLA Compliance', value: metrics?.sla_compliance_pct != null ? `${metrics.sla_compliance_pct.toFixed(0)}%` : '—' },
    { icon: <Star className="h-3.5 w-3.5 text-yellow-500" />, label: 'Customer Rating', value: metrics?.satisfaction_score != null ? `${metrics.satisfaction_score.toFixed(1)}/5` : '—' },
    { icon: <RotateCcw className="h-3.5 w-3.5 text-amber-500" />, label: 'Reopen Cases', value: String(reopened) },
    { icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />, label: 'Escalated', value: String(escalated) },
  ]

  return <StaffProfile user={user} teamName={teamName} stats={stats} />
}