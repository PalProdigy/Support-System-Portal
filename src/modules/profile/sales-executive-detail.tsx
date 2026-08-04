'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { UserAvatar } from '@/components/shared/user-avatar'
import { ErrorState } from '@/components/shared/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ROLE_LABELS } from '@/lib/rbac'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { ArrowLeft, Mail, Calendar, Eye, Handshake, CalendarClock } from 'lucide-react'
import type { Prospect, DealType } from '@/types'
import { SalesExecutiveProfile } from './sales-executive-profile'

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  installation: 'Installation',
  renewal: 'Renew',
  poc: 'POC',
}

const DEAL_TYPE_COLORS: Record<DealType, string> = {
  installation: 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400',
  renewal: 'border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-400',
  poc: 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400',
}

export function SalesExecutiveDetail({ id }: { id: string }) {
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: id, role: 'sales_executive' as const }
  const [showProfile, setShowProfile] = useState(false)

  const { data: users, isLoading: loadingUser } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })

  const user = (users ?? []).find((u) => u.id === id) ?? null

  const { data: prospects } = useQuery({
    queryKey: ['prospects', 'am-detail', id],
    queryFn: () => dp.listProspects(scope),
    enabled: !!user,
  })

  const prospectList: Prospect[] = prospects ?? []

  const wonDeals = useMemo(() => prospectList.filter((p) => p.stage === 'closed_won'), [prospectList])
  const lostDeals = useMemo(() => prospectList.filter((p) => p.stage === 'closed_lost'), [prospectList])

  const closedDeals = useMemo(
    () => [...wonDeals, ...lostDeals].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [wonDeals, lostDeals]
  )

  if (loadingUser) return <PageSkeleton onBack={() => router.back()} />

  if (!user || user.role !== 'sales_executive') {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <ErrorState message="Sales executive not found." />
      </div>
    )
  }

  const teamName = user.team_id ? (teams ?? []).find((t) => t.id === user.team_id)?.name : undefined

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Profile header — modern gradient hero */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 flex items-start gap-5 flex-wrap">
        <UserAvatar name={user.name} avatarUrl={user.avatar} size="lg" border shadow />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
              {user.designation && <p className="text-sm text-muted-foreground">{user.designation}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowProfile(true)}>
              <Eye className="h-3.5 w-3.5" /> View Full Profile
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {user.email}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              Joined {formatDateTime(user.created_at)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
            {teamName && <Badge variant="outline">{teamName}</Badge>}
          </div>
        </div>
      </div>

      {/* Deals — closed_won + closed_lost, classified by deal type */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Handshake className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Deals ({closedDeals.length})</h2>
        </div>
        {closedDeals.length === 0 ? (
          <div className="rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No deals closed yet — won and lost prospects will appear here.
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Company</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Contact</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">License Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {closedDeals.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{p.company_name}</p>
                      {p.converted_client_id && (
                        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">✓ Converted to client</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                      {p.contact_person}
                    </td>
                    <td className="px-4 py-3">
                      {p.deal_type ? (
                        <Badge variant="outline" className={cn('text-xs', DEAL_TYPE_COLORS[p.deal_type])}>
                          {DEAL_TYPE_LABELS[p.deal_type]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden lg:table-cell">
                      {p.license_expiry ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {formatDate(p.license_expiry)}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full profile modal — mounted only while open so it always fetches fresh data */}
      {showProfile && (
        <Dialog open onOpenChange={setShowProfile}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Sales Executive Profile</DialogTitle>
            </DialogHeader>
            <SalesExecutiveProfile user={user} teamName={teamName} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function PageSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}
