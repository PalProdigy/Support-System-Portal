'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { getDataProvider } from '@/lib/data'
import { UserAvatar } from '@/components/shared/user-avatar'
import { ErrorState } from '@/components/shared/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ROLE_LABELS } from '@/lib/rbac'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import {
  ArrowLeft, Mail, Calendar, Building2, Target, Trophy,
  Ticket, CheckCircle2, TrendingUp, Eye,
} from 'lucide-react'
import type { Client, Prospect, ProspectStage, Case } from '@/types'
import { SalesExecutiveProfile } from './sales-executive-profile'

const STAGE_LABELS: Record<ProspectStage, string> = {
  discovery: 'Discovery',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

const STAGE_COLORS: Record<ProspectStage, string> = {
  discovery: '#3b82f6',
  proposal: '#8b5cf6',
  negotiation: '#f59e0b',
  closed_won: '#10b981',
  closed_lost: '#ef4444',
}

function fmtCurrency(n: number) {
  return n >= 1_000_000 ? `৳${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `৳${(n / 1_000).toFixed(0)}K` : `৳${n}`
}

export function SalesExecutiveDetail({ id }: { id: string }) {
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: id, role: 'sales_executive' as const }
  const [showProfile, setShowProfile] = useState(false)

  const { data: users, isLoading: loadingUser } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })

  const user = (users ?? []).find((u) => u.id === id) ?? null

  const { data: clients } = useQuery({
    queryKey: ['clients', 'am-detail', id],
    queryFn: () => dp.listClients(scope),
    enabled: !!user,
  })
  const { data: prospects } = useQuery({
    queryKey: ['prospects', 'am-detail', id],
    queryFn: () => dp.listProspects(scope),
    enabled: !!user,
  })
  const { data: casesPage } = useQuery({
    queryKey: ['cases', 'am-detail', id],
    queryFn: () => dp.listCases(scope, { pageSize: 500 }),
    enabled: !!user,
  })

  const clientList: Client[] = clients ?? []
  const prospectList: Prospect[] = prospects ?? []
  const cases: Case[] = casesPage?.items ?? []

  const openPipeline = useMemo(() => prospectList.filter((p) => !['closed_won', 'closed_lost'].includes(p.stage)), [prospectList])
  const wonDeals = useMemo(() => prospectList.filter((p) => p.stage === 'closed_won'), [prospectList])
  const lostDeals = useMemo(() => prospectList.filter((p) => p.stage === 'closed_lost'), [prospectList])
  const openCases = useMemo(() => cases.filter((c) => !['resolved', 'pending_closure', 'closed'].includes(c.status)), [cases])
  const resolvedCases = useMemo(() => cases.filter((c) => ['resolved', 'pending_closure', 'closed'].includes(c.status)), [cases])

  const winRatePct = (wonDeals.length + lostDeals.length) > 0
    ? (wonDeals.length / (wonDeals.length + lostDeals.length)) * 100
    : null

  const pipelineValue = useMemo(
    () => openPipeline.reduce((sum, p) => sum + (p.estimated_value ?? 0), 0),
    [openPipeline]
  )

  // Pie: prospects by stage
  const pieData = useMemo(() => {
    const counts = new Map<ProspectStage, number>()
    prospectList.forEach((p) => counts.set(p.stage, (counts.get(p.stage) ?? 0) + 1))
    return Array.from(counts.entries())
      .map(([stage, value]) => ({ name: STAGE_LABELS[stage], value, color: STAGE_COLORS[stage] }))
      .filter((d) => d.value > 0)
  }, [prospectList])

  // Bar: monthly new prospects vs won deals (last 6 months)
  const monthlyData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const monthIdx = d.getMonth()
      const year = d.getFullYear()
      return {
        name: d.toLocaleString('default', { month: 'short' }),
        'New Prospects': prospectList.filter((p) => {
          const cd = new Date(p.created_at)
          return cd.getMonth() === monthIdx && cd.getFullYear() === year
        }).length,
        'Won Deals': prospectList.filter((p) => {
          if (p.stage !== 'closed_won') return false
          const ud = new Date(p.updated_at)
          return ud.getMonth() === monthIdx && ud.getFullYear() === year
        }).length,
      }
    })
  }, [prospectList])

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

      {/* Profile header */}
      <div className="rounded-xl border bg-card p-6 flex items-start gap-5 flex-wrap">
        <UserAvatar name={user.name} avatarUrl={user.avatar} size="lg" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
            <Button variant="outline" size="sm" onClick={() => setShowProfile(true)}>
              <Eye className="h-3.5 w-3.5" /> View
            </Button>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span>{user.email}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>Joined {formatDateTime(user.created_at)}</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
            {teamName && <Badge variant="outline">{teamName}</Badge>}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="flex flex-nowrap gap-4 overflow-x-auto pb-1">
        <KpiCard className="min-w-[180px] flex-1" icon={<Building2 className="h-5 w-5 text-blue-500" />} label="Managed Clients" value={String(clientList.length)} />
        <KpiCard className="min-w-[180px] flex-1" icon={<Target className="h-5 w-5 text-violet-500" />} label="Open Pipeline" value={String(openPipeline.length)} sub={pipelineValue > 0 ? fmtCurrency(pipelineValue) : undefined} />
        <KpiCard className="min-w-[180px] flex-1" icon={<Trophy className="h-5 w-5 text-amber-500" />} label="Won Deals" value={String(wonDeals.length)} />
        <KpiCard className="min-w-[180px] flex-1" icon={<Ticket className="h-5 w-5 text-slate-400" />} label="Open Cases" value={String(openCases.length)} />
        <KpiCard className="min-w-[180px] flex-1" icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} label="Resolved Cases" value={String(resolvedCases.length)} />
      </div>

      {/* Win-rate bar */}
      {winRatePct != null && (
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-semibold">Win Rate</span>
            </div>
            <span className={`text-sm font-bold ${
              winRatePct >= 60 ? 'text-emerald-600'
              : winRatePct >= 30 ? 'text-amber-600'
              : 'text-red-600'}`}>
              {winRatePct.toFixed(0)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                winRatePct >= 60 ? 'bg-emerald-500'
                : winRatePct >= 30 ? 'bg-amber-500'
                : 'bg-red-500'}`}
              style={{ width: `${Math.min(winRatePct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {wonDeals.length} won out of {wonDeals.length + lostDeals.length} closed deals
          </p>
        </div>
      )}

      {/* Charts */}
      {prospectList.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold">Pipeline Distribution</p>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No pipeline data</p>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold">Monthly Activity (last 6 months)</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} barSize={14} barGap={4}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="New Prospects" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Won Deals" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabbed: Clients + Prospects */}
      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Managed Clients ({clientList.length})
          </TabsTrigger>
          <TabsTrigger value="prospects" className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Pipeline ({prospectList.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Clients tab ───────────────────────────────────────────────── */}
        <TabsContent value="clients" className="mt-4">
          {clientList.length === 0 ? (
            <div className="rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No clients managed by this sales executive yet.
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Company</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Contact</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Tier</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clientList.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{c.company_name}</p>
                        <p className="text-xs text-muted-foreground">{c.industry ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                        {c.contact_person}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {c.account_tier
                          ? <Badge variant="outline" className="text-xs capitalize">{c.account_tier}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={c.account_status === 'at_risk' ? 'destructive' : c.account_status === 'churned' ? 'secondary' : 'outline'}
                          className="text-xs capitalize"
                        >
                          {c.account_status ?? 'active'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden lg:table-cell">
                        {c.last_activity_at ? formatDate(c.last_activity_at) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Prospects tab ─────────────────────────────────────────────── */}
        <TabsContent value="prospects" className="mt-4">
          {prospectList.length === 0 ? (
            <div className="rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No prospects in the pipeline yet.
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Company</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Contact</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Stage</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Est. Value</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {prospectList.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{p.company_name}</p>
                        {p.converted_client_id && (
                          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">✓ Converted</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                        {p.contact_person}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs" style={{ borderColor: STAGE_COLORS[p.stage], color: STAGE_COLORS[p.stage] }}>
                          {STAGE_LABELS[p.stage]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {p.estimated_value ? fmtCurrency(p.estimated_value) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden lg:table-cell">
                        {formatDate(p.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

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

function KpiCard({ icon, label, value, sub, className }: { icon: React.ReactNode; label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 flex items-center gap-3', className)}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

function PageSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
      <Skeleton className="h-32 rounded-xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}
