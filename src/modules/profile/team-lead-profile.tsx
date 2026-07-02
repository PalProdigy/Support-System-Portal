'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/shared/user-avatar'
import { ProfileHeader, KpiCard, InfoCard, InfoRow } from './shared'
import { ROLE_LABELS } from '@/lib/rbac'
import { Ticket, AlertTriangle, CheckCircle2, Users, ExternalLink } from 'lucide-react'
import type { Case, User } from '@/types'

export function TeamLeadProfile({ user }: { user: User }) {
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: user.id, role: user.role }

  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: casesPage } = useQuery({
    queryKey: ['cases', 'lead-profile', user.id],
    queryFn: () => dp.listCases(scope, { pageSize: 500 }),
  })

  const ledTeam = (teams ?? []).find((t) => t.lead_user_id === user.id)
  const members = (users ?? []).filter((u) => u.team_id === ledTeam?.id && u.id !== user.id)
  const cases: Case[] = casesPage?.items ?? []
  const openCases = cases.filter((c) => !['resolved', 'pending_closure', 'closed'].includes(c.status))
  const resolved = cases.filter((c) => ['resolved', 'pending_closure', 'closed'].includes(c.status))
  const escalated = cases.filter((c) => c.is_escalated || c.status === 'escalated')

  return (
    <>
      <ProfileHeader user={user} badges={ledTeam && <Badge variant="outline">{ledTeam.name}</Badge>} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard icon={<Users className="h-5 w-5 text-blue-500" />} label="Team Members" value={String(members.length)} />
        <KpiCard icon={<Ticket className="h-5 w-5 text-slate-400" />} label="Open Cases" value={String(openCases.length)} />
        <KpiCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} label="Resolved" value={String(resolved.length)} />
        <KpiCard icon={<AlertTriangle className="h-5 w-5 text-red-500" />} label="Escalated" value={String(escalated.length)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InfoCard title="Team Led" icon={<Users className="h-3.5 w-3.5" />}>
          {ledTeam ? (
            <>
              <InfoRow label="Team" value={ledTeam.name} />
              <InfoRow label="Members" value={String(members.length)} />
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => router.push('/lead')}>
                <ExternalLink className="h-3 w-3" /> Open Lead Hub
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Not currently assigned as a team lead.</p>
          )}
        </InfoCard>

        <InfoCard title="Members" icon={<Users className="h-3.5 w-3.5" />}>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members in this team yet.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <UserAvatar name={m.name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[m.role]}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </InfoCard>
      </div>
    </>
  )
}
