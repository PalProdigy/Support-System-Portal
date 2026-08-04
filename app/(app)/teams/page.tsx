'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { IconField } from '@/components/shared/icon-field'
import { SearchableSelect } from '@/components/shared/searchable-select'
import { ROLE_LABELS } from '@/lib/rbac'
import { toast } from '@/hooks/use-toast'
import { Headset, PlusCircle, ChevronRight, Star, Crown, Shapes, UsersRound, Search } from 'lucide-react'
import type { Team, User, Solution, EngineerMetrics } from '@/types'
import { useRouter } from 'next/navigation'

// Team lead: look up own team_id and redirect straight to that team's detail page
function TeamLeadRedirect() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()

  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['users', session.userId],
    queryFn: () => dp.getUser(session.userId),
  })

  useEffect(() => {
    if (currentUser?.team_id) {
      router.replace(`/teams/${currentUser.team_id}`)
    }
  }, [currentUser, router])

  if (isLoading || currentUser?.team_id) {
    return (
      <div className="p-6 space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Teams</h1>
      <p className="text-sm text-muted-foreground">You are not currently assigned to a team.</p>
    </div>
  )
}

// Technical head: full teams list with create capability
function THTeamsPage() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', lead_user_id: '', member_ids: [] as string[], solution_ids: [] as string[] })
  const [serviceQuery, setServiceQuery] = useState('')
  const [engineerQuery, setEngineerQuery] = useState('')
  const scope = { userId: session.userId, role: session.role }

  const { data: teams, isLoading } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: solutions } = useQuery({ queryKey: ['solutions'], queryFn: () => dp.listSolutions() })
  const { data: allMetrics } = useQuery({
    queryKey: ['engineer-metrics-all'],
    queryFn: () => dp.listAllEngineerMetrics(scope),
  })
  const { data: pendingMemberRequests } = useQuery({
    queryKey: ['team-member-requests', 'all-pending'],
    queryFn: () => dp.listAllPendingTeamMemberRequests(),
    enabled: session.role === 'technical_head',
  })
  const { data: pendingTransferRequests } = useQuery({
    queryKey: ['case-transfer-requests', 'all-pending'],
    queryFn: () => dp.listAllPendingCaseTransferRequests(),
    enabled: session.role === 'technical_head',
  })

  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))
  const solutionsMap = Object.fromEntries((solutions ?? []).map((s: Solution) => [s.id, s]))
  const potentialLeads = (users ?? []).filter((u: User) => ['team_lead', 'technical_head'].includes(u.role) && u.is_active)
  const supportEngineers = (users ?? []).filter((u: User) => u.role === 'support_engineer' && u.is_active)
  const metricsMap = Object.fromEntries((allMetrics ?? []).map((m: EngineerMetrics) => [m.engineer_id, m]))
  const teamsWithPending = new Set([
    ...(pendingMemberRequests ?? []).map((r) => r.team_id),
    ...(pendingTransferRequests ?? []).map((r) => r.team_id),
  ])
  const totalMembers = (users ?? []).filter((u: User) => u.team_id).length

  const toggleMember = (userId: string) => {
    setForm((prev) => ({
      ...prev,
      member_ids: prev.member_ids.includes(userId)
        ? prev.member_ids.filter((id) => id !== userId)
        : [...prev.member_ids, userId],
    }))
  }

  const toggleSolution = (solutionId: string) => {
    setForm((prev) => ({
      ...prev,
      solution_ids: prev.solution_ids.includes(solutionId)
        ? prev.solution_ids.filter((id) => id !== solutionId)
        : [...prev.solution_ids, solutionId],
    }))
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const team = await dp.createTeam({ name: form.name, lead_user_id: form.lead_user_id, solution_ids: form.solution_ids })
      await Promise.all(form.member_ids.map((uid) => dp.updateUser(uid, { team_id: team.id })))
      return team
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] })
      qc.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Team created', variant: 'success' })
      setShowCreate(false)
      setForm({ name: '', lead_user_id: '', member_ids: [], solution_ids: [] })
      setServiceQuery('')
      setEngineerQuery('')
    },
    onError: () => toast({ title: 'Failed to create team', variant: 'destructive' }),
  })

  const thinScroll =
      "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent " +
      "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 " +
      "hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50"

  const teamMembers = (teamId: string) =>
    (users ?? []).filter((u: User) => u.team_id === teamId)

  const teamAvgSatisfaction = (teamId: string) => {
    const scores = teamMembers(teamId)
      .filter((m) => m.role === 'support_engineer')
      .map((m) => metricsMap[m.id]?.satisfaction_score)
      .filter((s): s is number => s != null)
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header — modern gradient hero */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/15 p-2.5 shrink-0">
            <Headset className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Teams</h1>
            <p className="text-sm text-muted-foreground">
              {teams?.length ?? 0} team{(teams?.length ?? 0) === 1 ? '' : 's'} · {totalMembers} member{totalMembers === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        {session.role === 'technical_head' && (
          <Button onClick={() => setShowCreate(true)}>
            <PlusCircle className="h-4 w-4" /> Add Team
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-44 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : (teams ?? []).length === 0 ? (
        <EmptyState icon={Headset} title="No teams" description="Create your first support team." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(teams ?? []).map((t: Team) => {
            const lead = usersMap[t.lead_user_id]
            const members = teamMembers(t.id)
            const services = (t.solution_ids ?? []).map((id) => solutionsMap[id]).filter((s): s is Solution => !!s)
            const avgSatisfaction = teamAvgSatisfaction(t.id)
            return (
              <div
                key={t.id}
                className={cn(
                  'rounded-xl border bg-card p-4 space-y-3.5 cursor-pointer transition-all duration-150',
                  'hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40'
                )}
                onClick={() => router.push(`/teams/${t.id}`)}
              >
                {/* Title row */}
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5 shrink-0"><Headset className="h-5 w-5 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold leading-tight truncate">{t.name}</p>
                      {t.is_active === false
                        ? <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-zinc-800 text-zinc-100 hover:bg-zinc-800 shrink-0">Deactive</Badge>
                        : <Badge variant="default" className="text-[10px] h-4 px-1.5 bg-emerald-500 hover:bg-emerald-500 text-white shrink-0">Active</Badge>
                      }
                      {session.role === 'technical_head' && teamsWithPending.has(t.id) && (
                        <span title="Pending requests" className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                        </span>
                      )}
                    </div>
                    {lead && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                        <Crown className="h-3 w-3 shrink-0 text-amber-500" /> {lead.name}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>

                {/* Services */}
                {services.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Shapes className="h-3 w-3 text-muted-foreground shrink-0" />
                    {services.slice(0, 3).map((s) => (
                      <span key={s.id} className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{s.name}</span>
                    ))}
                    {services.length > 3 && (
                      <span className="text-[10px] font-medium text-muted-foreground">+{services.length - 3} more</span>
                    )}
                  </div>
                )}

                {/* Stats + member stack */}
                <div className="flex items-center justify-between gap-3 pt-1 border-t">
                  <div className="flex items-center gap-3 pt-2.5">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <UsersRound className="h-3 w-3" /> {members.length}
                    </span>
                    {avgSatisfaction != null && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" /> {avgSatisfaction.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center pt-2.5">
                    {members.slice(0, 5).map((m: User) => (
                      <UserAvatar
                        key={m.id}
                        name={m.name}
                        avatarUrl={m.avatar}
                        userId={m.id}
                        size="sm"
                        border
                        className="-ml-2 first:ml-0 ring-2 ring-card"
                      />
                    ))}
                    {members.length > 5 && (
                      <div className="-ml-2 h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground ring-2 ring-card">
                        +{members.length - 5}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) { setForm({ name: '', lead_user_id: '', member_ids: [], solution_ids: [] }); setServiceQuery(''); setEngineerQuery('') } }}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
          {/* Hero header */}
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-5 shrink-0">
            <DialogHeader className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/15 p-2.5 shrink-0">
                  <Headset className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle>Create Team</DialogTitle>
                  <DialogDescription>Set up a new support team</DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className={`flex-1 overflow-y-auto px-6 py-5 space-y-4 ${thinScroll}`}>
            <IconField
              icon={Headset}
              label="Team Name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Alpha Support Team"
            />

            <SearchableSelect
              label="Team Lead"
              required
              options={potentialLeads.map((u: User) => ({ id: u.id, label: u.name, sublabel: ROLE_LABELS[u.role], avatarUrl: u.avatar ?? '' }))}
              value={form.lead_user_id}
              onChange={(v) => setForm({ ...form, lead_user_id: v })}
              placeholder="Select lead"
              searchPlaceholder="Search leads…"
              emptyText="No matching leads"
            />

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Shapes className="h-3.5 w-3.5" /> Support Services <span className="text-destructive">*</span>
                {form.solution_ids.length > 0 && (
                  <span className="font-normal text-muted-foreground">({form.solution_ids.length} selected)</span>
                )}
              </Label>
              {form.solution_ids.length === 0 && (
                <p className="text-xs text-destructive">Select at least one support service.</p>
              )}
              {(solutions ?? []).filter((s: Solution) => s.is_active).length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No active services available.</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <div className="flex items-center gap-2 border-b px-3 py-2 bg-muted/20">
                    <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <input
                      value={serviceQuery}
                      onChange={(e) => setServiceQuery(e.target.value)}
                      placeholder="Search services…"
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className={`max-h-40 overflow-y-auto divide-y ${thinScroll}`}>
                    {(solutions ?? [])
                      .filter((s: Solution) => s.is_active)
                      .filter((s: Solution) => s.name.toLowerCase().includes(serviceQuery.toLowerCase()) || s.category.toLowerCase().includes(serviceQuery.toLowerCase()))
                      .map((s: Solution) => {
                        const selected = form.solution_ids.includes(s.id)
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleSolution(s.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50 ${selected ? 'bg-primary/5' : ''}`}
                          >
                            <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                              {selected && <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm">{s.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">({s.category})</span>
                            </div>
                          </button>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <UsersRound className="h-3.5 w-3.5" /> Support Engineers
                {form.member_ids.length > 0 && (
                  <span className="font-normal text-muted-foreground">({form.member_ids.length} selected)</span>
                )}
              </Label>
              {supportEngineers.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No active support engineers available.</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <div className="flex items-center gap-2 border-b px-3 py-2 bg-muted/20">
                    <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <input
                      value={engineerQuery}
                      onChange={(e) => setEngineerQuery(e.target.value)}
                      placeholder="Search engineers…"
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className={`max-h-48 overflow-y-auto divide-y ${thinScroll}`}>
                    {supportEngineers.filter((u: User) => u.name.toLowerCase().includes(engineerQuery.toLowerCase())).map((u: User) => {
                    const selected = form.member_ids.includes(u.id)
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleMember(u.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50 ${selected ? 'bg-primary/5' : ''}`}
                      >
                        <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                          {selected && <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <UserAvatar name={u.name} avatarUrl={u.avatar} userId={u.id} size="sm" />
                        <span className="text-sm flex-1">{u.name}</span>
                      </button>
                    )
                  })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/30 shrink-0">
            <Button variant="outline" onClick={() => { setShowCreate(false); setForm({ name: '', lead_user_id: '', member_ids: [], solution_ids: [] }); setServiceQuery(''); setEngineerQuery('') }}>Cancel</Button>
            <Button
              className="gap-1.5"
              disabled={createMutation.isPending || !form.name || !form.lead_user_id || form.solution_ids.length === 0}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Creating…' : (<><PlusCircle className="h-4 w-4" /> Create Team</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function TeamsPage() {
  const session = useSession()
  if (session.role === 'team_lead') return <TeamLeadRedirect />
  return <THTeamsPage />
}
