'use client'

import { useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Label } from '@/components/ui/label'
import { UserAvatar } from '@/components/shared/user-avatar'
import { EmptyState } from '@/components/shared/empty-state'
import { IconField } from '@/components/shared/icon-field'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { cn, formatBytes } from '@/lib/utils'
import {
  PlusCircle, Users, Eye, Wrench, Crown, Clock, LayoutGrid,
  UserRound, Mail, Phone, Briefcase, IdCard, CalendarDays, Camera, ImageUp, UserPlus,
} from 'lucide-react'
import type { User, Role, CertificationLevel, Team } from '@/types'

type Tab = 'all' | 'leads' | 'engineers'

const IMG_MAX = 2 * 1024 * 1024 // 2 MB avatar cap (kept small so it persists in localStorage)

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const todayISODate = () => new Date().toISOString().slice(0, 10)

const EMPTY_ENGINEER_FORM = {
  name: '', email: '', phone: '', designation: '', avatar: '',
  joiningDate: todayISODate(),
  employeeId: '',
}

function RoleBadge({ role }: { role: Role }) {
  return role === 'team_lead' ? (
    <Badge variant="outline" className="text-[10px] gap-1 border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-400">
      <Crown className="h-2.5 w-2.5" /> Team Lead
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] gap-1 border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400">
      <Wrench className="h-2.5 w-2.5" /> Support Engineer
    </Badge>
  )
}

function LeadsChip({ team }: { team?: Team }) {
  if (!team) return <span className="text-muted-foreground text-xs">—</span>
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
      <Crown className="h-3 w-3" />
      {team.name}
      {team.is_active === false && <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">Inactive</Badge>}
    </span>
  )
}

function CertBadge({ level }: { level?: CertificationLevel }) {
  return level
    ? <Badge variant="outline" className="text-xs font-mono">{level}</Badge>
    : <span className="text-muted-foreground text-xs">—</span>
}

function YearsCell({ years }: { years?: number }) {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3 shrink-0" />
      {years != null ? `${years} yr${years === 1 ? '' : 's'}` : '—'}
    </span>
  )
}

// Team leads get a small crown badge pinned on their avatar.
function EngineerAvatar({ user }: { user: User }) {
  return (
    <div className="relative shrink-0">
      <UserAvatar name={user.name} avatarUrl={user.avatar} userId={user.id} size="lg" border shadow />
      {user.role === 'team_lead' && (
        <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow ring-2 ring-background">
          <Crown className="h-3 w-3" />
        </div>
      )}
    </div>
  )
}

export function ManageEngineers() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()
  const isLead = session.role === 'team_lead'

  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_ENGINEER_FORM)
  const avatarRef = useRef<HTMLInputElement>(null)

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })

  const createMutation = useMutation({
    mutationFn: async () => {
      const created = await dp.createUser({
        name: form.name,
        email: form.email.trim(),
        role: 'support_engineer',
        is_active: true,
        designation: form.designation.trim() || undefined,
        employee_id: form.employeeId.trim() || undefined,
        contact_numbers: form.phone.trim() ? [form.phone.trim()] : undefined,
        avatar: form.avatar || undefined,
      })
      // createUser always stamps created_at as "now" — overwrite it with the
      // chosen joining date so hire-date columns reflect reality.
      if (form.joiningDate) {
        return dp.updateUser(created.id, { created_at: new Date(`${form.joiningDate}T00:00:00`).toISOString() })
      }
      return created
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Engineer added', variant: 'success' })
      setShowCreate(false)
      setForm(EMPTY_ENGINEER_FORM)
    },
    onError: () => toast({ title: 'Create failed', variant: 'destructive' }),
  })

  async function onAvatarPick(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast({ title: 'Please choose an image file', variant: 'destructive' }); return }
    if (file.size > IMG_MAX) { toast({ title: `Image exceeds ${formatBytes(IMG_MAX)}`, variant: 'destructive' }); return }
    const dataUrl = await fileToDataUrl(file)
    setForm((f) => ({ ...f, avatar: dataUrl }))
  }

  function openCreate() {
    setForm({ ...EMPTY_ENGINEER_FORM, joiningDate: todayISODate() })
    setShowCreate(true)
  }

  const myTeamId = useMemo(
    () => (isLead ? (users ?? []).find((u) => u.id === session.userId)?.team_id : undefined),
    [isLead, users, session.userId]
  )
  const myTeam = useMemo(() => (teams ?? []).find((t) => t.id === myTeamId), [teams, myTeamId])

  const teamsMap = useMemo(() => Object.fromEntries((teams ?? []).map((t) => [t.id, t])), [teams])
  // user_id (of a team lead) → the team they lead
  const leadTeamMap = useMemo(() => Object.fromEntries((teams ?? []).map((t) => [t.lead_user_id, t])), [teams])
  // team_id → active support-engineer headcount, for the Team Leads tab
  const teamSizeMap = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const u of users ?? []) {
      if (u.role === 'support_engineer' && u.is_active && u.team_id) counts[u.team_id] = (counts[u.team_id] ?? 0) + 1
    }
    return counts
  }, [users])

  const visibleUsers = useMemo(() => {
    const q = query.toLowerCase()
    return (users ?? []).filter((u) =>
      (!isLead || u.team_id === myTeamId) &&
      (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    )
  }, [users, isLead, myTeamId, query])

  const allEngineers = useMemo(
    () => visibleUsers.filter((u) => u.role === 'team_lead' || u.role === 'support_engineer'),
    [visibleUsers]
  )
  const teamLeads = useMemo(() => visibleUsers.filter((u) => u.role === 'team_lead'), [visibleUsers])
  const supportEngineers = useMemo(() => visibleUsers.filter((u) => u.role === 'support_engineer'), [visibleUsers])

  const TABS: { key: Tab; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }>; count: number }[] = [
    { key: 'all', label: 'All Engineers', shortLabel: 'All', icon: LayoutGrid, count: allEngineers.length },
    ...(isLead ? [] : [{ key: 'leads' as Tab, label: 'Team Leads', shortLabel: 'Leads', icon: Crown, count: teamLeads.length }]),
    { key: 'engineers', label: 'Support Engineers', shortLabel: 'Engineers', icon: Wrench, count: supportEngineers.length },
  ]

  const activeTab = isLead && tab === 'leads' ? 'all' : tab
  const activeRows = activeTab === 'all' ? allEngineers : activeTab === 'leads' ? teamLeads : supportEngineers

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Wrench className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Engineers</h1>
          {/*<p className="text-sm text-muted-foreground">*/}
          {/*  {isLead && (myTeam ? `${myTeam.name} · ` : 'Your team · ')}*/}
          {/*  Team leads and support engineers across the organization*/}
          {/*</p>*/}
        </div>
      </div>

      {/* Tabs + search */}
      <div className="space-y-3 md:space-y-0 md:flex md:items-center md:justify-between md:gap-3">
        <div
          className={cn(
            'grid gap-1 px-1.5 bg-background border border-input rounded-lg shadow-sm hover:bg-[#020817]',
            TABS.length === 3 ? 'grid-cols-3' : 'grid-cols-2',
            'md:flex md:w-fit md:items-center md:gap-1'
          )}
        >
          {TABS.map(({ key, label, shortLabel, icon: Icon, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center justify-center gap-1.5 h-10 min-w-0 px-1 rounded-xl text-[13px] font-medium transition-colors',
                'md:px-4 md:text-sm',
                activeTab === key
                  ? 'bg-background border-input shadow-sm text-foreground'
                  : ' border-transparent text-muted-foreground hover:text-foreground '
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate md:hidden">{shortLabel}</span>
              <span className="truncate hidden md:inline">{label}</span>
              <span
                className={cn(
                  'text-[11px] px-1.5 rounded-full shrink-0 tabular-nums',
                  activeTab === key ? 'bg-muted text-foreground' : 'bg-muted/60 text-muted-foreground'
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2">
          <SearchInput
            containerClassName="w-full md:w-64"
            className="h-10"
            placeholder="Search engineers..."
            value={query}
            onChange={setQuery}
            aria-label="Search engineers"
            resultCount={activeRows.length}
            resultLabel="result"
          />
          <Button onClick={openCreate} variant="outline" className="h-10 min-w-0 w-full md:w-auto">
            <PlusCircle className="h-4 w-4 shrink-0" /> <span className="truncate">Add Engineer</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : activeRows.length === 0 ? (
        <EmptyState icon={Users} title={query ? `No results found for "${query}"` : 'No one here yet'} />
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                {activeTab === 'all' && (
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Role</th>
                )}
                {activeTab === 'leads' ? (
                  <>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Leads</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Team Size</th>
                  </>
                ) : (
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Team</th>
                )}
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Years of Experience</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Certification</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {activeRows.map((u: User) => {
                const detailHref = `/engineer/${u.id}`
                const ledTeam = leadTeamMap[u.id]
                return (
                  <tr
                    key={u.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button,input[type=checkbox]')) return
                      router.push(detailHref)
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <EngineerAvatar user={u} />
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    {activeTab === 'all' && (
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <RoleBadge role={u.role} />
                      </td>
                    )}
                    {activeTab === 'leads' ? (
                      <>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <LeadsChip team={ledTeam} />
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                          {ledTeam ? `${teamSizeMap[ledTeam.id] ?? 0} engineer${(teamSizeMap[ledTeam.id] ?? 0) === 1 ? '' : 's'}` : '—'}
                        </td>
                      </>
                    ) : (
                      <td className="px-4 py-3 hidden md:table-cell">
                        {u.role === 'team_lead'
                          ? <LeadsChip team={ledTeam} />
                          : <span className="text-muted-foreground text-xs">{u.team_id ? teamsMap[u.team_id]?.name ?? '—' : '—'}</span>}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <YearsCell years={u.years_of_experience} />
                    </td>
                    <td className="px-4 py-3">
                      <CertBadge level={u.certification_level} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => router.push(detailHref)}>
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog — Support Engineer only */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setForm(EMPTY_ENGINEER_FORM) }}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          {/* Hero header */}
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-5">
            <DialogHeader className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/15 p-2.5 shrink-0">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle>Add Engineer</DialogTitle>
                  <DialogDescription>Create a new support engineer profile</DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Profile Picture — centered hero upload */}
            <div className="flex flex-col items-center gap-2">
              <Label className="text-xs font-medium text-muted-foreground">Profile Picture</Label>
              <div className="relative">
                <UserAvatar name={form.name || 'New Engineer'} avatarUrl={form.avatar} size="xl" border shadow />
                <button
                  type="button"
                  onClick={() => avatarRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-background hover:opacity-90 transition-opacity"
                  title="Upload picture"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input ref={avatarRef} type="file" accept="image/*" className="sr-only" onChange={(e) => onAvatarPick(e.target.files?.[0] ?? undefined)} />
              </div>
              <button
                type="button"
                onClick={() => avatarRef.current?.click()}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <ImageUp className="h-3 w-3" /> {form.avatar ? 'Change photo' : 'Upload Photo'}
              </button>
              {form.avatar && (
                <button type="button" onClick={() => setForm({ ...form, avatar: '' })} className="text-xs text-muted-foreground hover:text-destructive">
                  Remove picture
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <IconField
                  icon={CalendarDays}
                  label="Joining Date"
                  required
                  type="date"
                  value={form.joiningDate}
                  onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                />
                <IconField
                  icon={IdCard}
                  label="Employee ID"
                  required
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  placeholder="e.g. NHQ-24-029"
                />
              </div>

              <IconField
                icon={UserRound}
                label="Full Name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. John Doe"
              />

              <IconField
                icon={Briefcase}
                label="Designation"
                required
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                placeholder="e.g. Software Engineer"
              />

              <IconField
                icon={Mail}
                label="Email"
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="e.g. john@company.com"
              />
              <IconField
                icon={Phone}
                label="Phone Number"
                required
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. +880 1700 000000"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              className="gap-1.5"
              disabled={createMutation.isPending || !form.name || !form.designation || !form.joiningDate || !form.employeeId || !form.email || !form.phone}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Creating…' : (<><PlusCircle className="h-4 w-4" /> Add Engineer</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
