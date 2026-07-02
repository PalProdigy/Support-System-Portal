'use client'

import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { Badge } from '@/components/ui/badge'
import { ProfileHeader, KpiCard, InfoCard, InfoRow } from './shared'
import { formatDuration } from '@/lib/utils'
import { Ticket, CheckCircle2, Clock, Star, Award, Briefcase, TrendingUp } from 'lucide-react'
import type { User } from '@/types'

export function SupportEngineerProfile({ user, teamName }: { user: User; teamName?: string }) {
  const dp = getDataProvider()
  const scope = { userId: user.id, role: user.role }

  const { data: metrics } = useQuery({
    queryKey: ['engineer-metrics', user.id],
    queryFn: () => dp.getEngineerMetrics(user.id, scope),
  })

  return (
    <>
      <ProfileHeader
        user={user}
        badges={
          <>
            {user.certification_level && (
              <Badge variant="outline" className="font-mono gap-1">
                <Award className="h-3 w-3" /> {user.certification_level}
              </Badge>
            )}
            {teamName && <Badge variant="outline">{teamName}</Badge>}
          </>
        }
      />

      {/* Experience + certification */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          icon={<Briefcase className="h-5 w-5 text-blue-500" />}
          label="Years of Experience"
          value={user.years_of_experience != null ? `${user.years_of_experience} ${user.years_of_experience === 1 ? 'year' : 'years'}` : '—'}
        />
        <KpiCard
          icon={<Award className="h-5 w-5 text-violet-500" />}
          label="Certification Level"
          value={user.certification_level ?? '—'}
        />
      </div>

      {/* Performance metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} label="Total Solved" value={String(metrics?.total_resolved ?? 0)} />
        <KpiCard icon={<Ticket className="h-5 w-5 text-slate-400" />} label="Open Cases" value={String(metrics?.open_cases ?? 0)} />
        <KpiCard
          icon={<Clock className="h-5 w-5 text-blue-400" />}
          label="Avg Resolution"
          value={metrics?.avg_resolution_hours != null ? formatDuration(metrics.avg_resolution_hours * 3_600_000) : '—'}
        />
        <KpiCard
          icon={<Star className="h-5 w-5 text-yellow-500" />}
          label="Satisfaction"
          value={metrics?.satisfaction_score != null ? `${metrics.satisfaction_score.toFixed(1)} / 5` : '—'}
          sub={metrics?.total_feedback_count ? `${metrics.total_feedback_count} reviews` : undefined}
        />
      </div>

      {/* SLA compliance */}
      {metrics && (
        <InfoCard title="SLA Compliance" icon={<TrendingUp className="h-3.5 w-3.5" />}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Cases resolved within SLA</span>
            <span className={`text-sm font-bold ${
              metrics.sla_compliance_pct >= 90 ? 'text-emerald-600'
              : metrics.sla_compliance_pct >= 70 ? 'text-amber-600'
              : 'text-red-600'}`}>
              {metrics.sla_compliance_pct.toFixed(0)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                metrics.sla_compliance_pct >= 90 ? 'bg-emerald-500'
                : metrics.sla_compliance_pct >= 70 ? 'bg-amber-500'
                : 'bg-red-500'}`}
              style={{ width: `${Math.min(metrics.sla_compliance_pct, 100)}%` }}
            />
          </div>
        </InfoCard>
      )}

      <InfoCard title="Account">
        <InfoRow label="Email" value={user.email} />
        <InfoRow label="Team" value={teamName ?? 'Unassigned'} />
        <InfoRow label="Status" value={user.is_active ? 'Active' : 'Inactive'} />
      </InfoCard>
    </>
  )
}