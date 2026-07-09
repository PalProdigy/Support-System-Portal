'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserAvatar } from '@/components/shared/user-avatar'
import { EmptyState } from '@/components/shared/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { ROLE_LABELS } from '@/lib/rbac'
import { PlusCircle, Search, Users, Loader2 } from 'lucide-react'
import type { User, Role } from '@/types'
import { useRouter } from 'next/navigation'

const TARGET_ROLE: Role = 'team_lead'

export default function TeamLeadPage() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()

  if (session.role !== 'technical_head') {
    router.replace('/dashboard')
    return null
  }

  return <TeamLeadContent />
}

function TeamLeadContent() {
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', is_active: true })

  const runSearch = () => {
    setIsSearching(true)
    setQuery(search)
    setTimeout(() => setIsSearching(false), 300)
  }

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })

  const createMutation = useMutation({
    mutationFn: () => dp.createUser({ name: form.name, email: form.email, role: TARGET_ROLE, is_active: form.is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Team Lead added', variant: 'success' })
      setShowCreate(false)
      setForm({ name: '', email: '', is_active: true })
    },
    onError: () => toast({ title: 'Create failed', variant: 'destructive' }),
  })

  const filtered = (users ?? []).filter((u: User) =>
    u.role === TARGET_ROLE &&
    (u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase()))
  )

  // Map: user_id → team they lead
  const leadTeamMap = Object.fromEntries(
    (teams ?? []).map((t) => [t.lead_user_id, t])
  )

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team Leads</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} module leads</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <PlusCircle className="h-4 w-4" /> Add Team Lead
        </Button>
      </div>

      <div className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search module leads..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
          />
        </div>
        <Button onClick={runSearch} disabled={isSearching} aria-label="Search">
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4" />Search</>}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No module leads found" />
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Team Lead</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Team Led</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((u: User) => {
                const teamLed = leadTeamMap[u.id]
                return (
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
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">{ROLE_LABELS[u.role]}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                      {teamLed ? (
                        <span className="flex items-center gap-1">
                          {teamLed.name}
                          {teamLed.is_active === false && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">Inactive</Badge>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setForm({ name: '', email: '', is_active: true }) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Team Lead</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@company.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={createMutation.isPending || !form.name || !form.email} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? 'Creating...' : 'Add Team Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
