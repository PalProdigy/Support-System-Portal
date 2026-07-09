'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserAvatar } from '@/components/shared/user-avatar'
import { EmptyState } from '@/components/shared/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { PlusCircle, Users } from 'lucide-react'
import type { User, Role, CertificationLevel } from '@/types'
import { canAccess } from '@/lib/rbac'
import { useRouter } from 'next/navigation'

const CERT_LEVELS: CertificationLevel[] = ['L1', 'L2', 'L3', 'L4', 'L5']

export default function SupportEngineersPage() {
  const session = useSession()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  if (!canAccess(scope, 'manage_users', 'user')) {
    router.replace('/dashboard')
    return null
  }

  return <SupportEngineersContent />
}

function SupportEngineersContent() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<{
    name: string
    email: string
    role: Role
    is_active: boolean
    years_of_experience?: number
    certification_level?: CertificationLevel
  }>({ name: '', email: '', role: 'support_engineer', is_active: true })
  const TARGET_ROLE: Role = 'support_engineer'

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => dp.listUsers(),
  })

  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })

  const createMutation = useMutation({
    mutationFn: () => dp.createUser({ ...form }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast({ title: 'User created', variant: 'success' }); setShowCreate(false); setForm({ name: '', email: '', role: 'support_engineer', is_active: true }) },
    onError: () => toast({ title: 'Create failed', variant: 'destructive' }),
  })

  const filtered = (users ?? []).filter((u: User) =>
    u.role === TARGET_ROLE &&
    (u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase()))
  )

  const teamsMap = Object.fromEntries((teams ?? []).map((t) => [t.id, t]))

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Support Engineers</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} engineers</p>
        </div>
        <SearchInput
          containerClassName="w-full max-w-xs"
          placeholder="Search users..."
          value={query}
          onChange={setQuery}
          aria-label="Search support engineers"
          resultCount={filtered.length}
          resultLabel="engineer"
        />
        <Button onClick={() => setShowCreate(true)} className="hidden">
          <PlusCircle className="h-4 w-4" /> Add Engineer
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title={query ? `No results found for "${query}"` : 'No support engineers found'} />
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Team</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Years of Experience</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Certification</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((u: User) => (
                <tr
                  key={u.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button,input[type=checkbox]')) return
                    router.push(`/users/${u.id}`)
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar name={u.name} avatarUrl={u.avatar} size="sm" />
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                    {u.team_id ? teamsMap[u.team_id]?.name ?? '-' : '-'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.years_of_experience != null
                      ? `${u.years_of_experience} ${u.years_of_experience === 1 ? 'year' : 'years'}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {u.certification_level
                      ? <Badge variant="outline" className="text-xs font-mono">{u.certification_level}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setForm({ name: '', email: '', role: TARGET_ROLE, is_active: true }) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Support Engineer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@company.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Years of Experience</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.years_of_experience ?? ''}
                  onChange={(e) => setForm({ ...form, years_of_experience: e.target.value === '' ? undefined : Number(e.target.value) })}
                  placeholder="e.g. 5"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Certification</Label>
                <Select
                  value={form.certification_level ?? 'none'}
                  onValueChange={(v) => setForm({ ...form, certification_level: v === 'none' ? undefined : v as CertificationLevel })}
                >
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {CERT_LEVELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={createMutation.isPending || !form.name || !form.email} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? 'Creating...' : 'Add Engineer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}