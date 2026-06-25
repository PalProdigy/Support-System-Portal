'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { toast } from '@/hooks/use-toast'
import { Headset, PlusCircle, Users, ChevronRight, Star } from 'lucide-react'
import type { Team, User, Solution, EngineerMetrics } from '@/types'
import { useRouter } from 'next/navigation'

// Module lead: look up own team_id and redirect straight to that team's detail page
function ModuleLeadRedirect() {
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
  const potentialLeads = (users ?? []).filter((u: User) => ['module_lead', 'technical_head'].includes(u.role) && u.is_active)
  const supportEngineers = (users ?? []).filter((u: User) => u.role === 'support_engineer' && u.is_active)
  const metricsMap = Object.fromEntries((allMetrics ?? []).map((m: EngineerMetrics) => [m.engineer_id, m]))
  const teamsWithPending = new Set([
    ...(pendingMemberRequests ?? []).map((r) => r.team_id),
    ...(pendingTransferRequests ?? []).map((r) => r.team_id),
  ])

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
    },
    onError: () => toast({ title: 'Failed to create team', variant: 'destructive' }),
  })

  const thinScroll =
      "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent " +
      "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 " +
      "hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50"

  const teamMembers = (teamId: string) =>
    (users ?? []).filter((u: User) => u.team_id === teamId)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-sm text-muted-foreground">{teams?.length ?? 0} teams</p>
        </div>
        {session.role === 'technical_head' && (
          <Button onClick={() => setShowCreate(true)}>
            <PlusCircle className="h-4 w-4" /> Add Team
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[...Array(2)].map((_, i) => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : (teams ?? []).length === 0 ? (
        <EmptyState icon={Headset} title="No teams" description="Create your first support team." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(teams ?? []).map((t: Team) => {
            const lead = usersMap[t.lead_user_id]
            const members = teamMembers(t.id)
            return (
              <div
                key={t.id}
                className="rounded-xl border bg-card p-4 space-y-3 hover:shadow-sm hover:border-primary/40 transition-all cursor-pointer"
                onClick={() => router.push(`/teams/${t.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5 shrink-0"><Headset className="h-5 w-5 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold leading-tight">{t.name}</p>
                      {t.is_active === false
                        ? <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-zinc-800 text-zinc-100 hover:bg-zinc-800">Deactive</Badge>
                        : <Badge variant="default" className="text-[10px] h-4 px-1.5 bg-emerald-500 hover:bg-emerald-500 text-white">Active</Badge>
                      }
                      {session.role === 'technical_head' && teamsWithPending.has(t.id) && (
                        <span title="Pending requests" className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                        </span>
                      )}
                    </div>
                    {lead && <p className="text-xs text-muted-foreground mt-0.5">Lead: {lead.name}</p>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Users className="h-3 w-3" /> {members.length} members
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m: User) => (
                      <div key={m.id} className="flex items-center gap-1 text-xs text-foreground">
                        <UserAvatar name={m.name} size="sm" />
                        <span className="text-xs">{m.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) setForm({ name: '', lead_user_id: '', member_ids: [], solution_ids: [] }) }}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Create Team</DialogTitle></DialogHeader>
          <div className={`flex-1 overflow-y-auto space-y-4 px-1  ${thinScroll}`}>
            <div className="space-y-1.5">
              <Label>Team Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Alpha Support Team" />
            </div>
            <div className="space-y-1.5">
              <Label>Team Lead</Label>
              <Select value={form.lead_user_id} onValueChange={(v) => setForm({ ...form, lead_user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
                <SelectContent>
                  {potentialLeads.map((u: User) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Support Services <span className="text-destructive">*</span>
                {form.solution_ids.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">({form.solution_ids.length} selected)</span>
                )}
              </Label>
              {form.solution_ids.length === 0 && (
                <p className="text-xs text-destructive">Select at least one support service.</p>
              )}
              {(solutions ?? []).filter((s: Solution) => s.is_active).length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No active services available.</p>
              ) : (
                <div className={`max-h-40 overflow-y-auto rounded-md border divide-y ${thinScroll}`}>
                  {(solutions ?? []).filter((s: Solution) => s.is_active).map((s: Solution) => {
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
              )}
            </div>
            <div className="space-y-1.5">
              <Label>
                Support Engineers
                {form.member_ids.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">({form.member_ids.length} selected)</span>
                )}
              </Label>
              {supportEngineers.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No active support engineers available.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                  {supportEngineers.map((u: User) => {
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
                        <UserAvatar name={u.name} size="sm" />
                        <span className="text-sm flex-1">{u.name}</span>
                        <span className="flex items-center gap-0.5 shrink-0 text-xs text-muted-foreground ml-auto">
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          {metricsMap[u.id]?.satisfaction_score != null
                            ? metricsMap[u.id]!.satisfaction_score!.toFixed(1)
                            : '—'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setForm({ name: '', lead_user_id: '', member_ids: [], solution_ids: [] }) }}>Cancel</Button>
            <Button disabled={createMutation.isPending || !form.name || !form.lead_user_id || form.solution_ids.length === 0} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function TeamsPage() {
  const session = useSession()
  if (session.role === 'module_lead') return <ModuleLeadRedirect />
  return <THTeamsPage />
}
