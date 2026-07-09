'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserAvatar } from '@/components/shared/user-avatar'
import { EmptyState } from '@/components/shared/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { PlusCircle, Briefcase, Clock, Eye, IdCard, Building2, Ticket, CalendarDays } from 'lucide-react'
import type { User, Role, Client, Case } from '@/types'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { isOpen } from '@/modules/profile/case-stats'
import { useSession } from '@/lib/auth/context'

const TARGET_ROLE: Role = 'sales_executive'

interface ManageSalesExecutivesProps {
  query: string
  onResultCountChange?: (count: number) => void
}

/**
 * Technical-Head directory for managing Sales Executive user accounts.
 * Rendered as a tab inside the Sales Hub (/sales-executive); access is
 * already gated by the parent page. The search box lives in the page
 * header, so filtering is driven by the `query` prop.
 */
export function ManageSalesExecutives({ query, onResultCountChange }: ManageSalesExecutivesProps) {
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()
  const session = useSession()

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', is_active: true })

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })

  // Technical Head sees every client/case, used below to derive per-sales-executive
  // "Assigned Clients" and "Open Cases" counts without a query per row.
  const scope = { userId: session.userId, role: 'technical_head' as Role }
  const { data: clients } = useQuery({ queryKey: ['clients', 'th-all'], queryFn: () => dp.listClients(scope) })
  const { data: casesPage } = useQuery({ queryKey: ['cases', 'th-all'], queryFn: () => dp.listCases(scope, { pageSize: 500 }) })

  const createMutation = useMutation({
    mutationFn: () => dp.createUser({ name: form.name, email: form.email, role: TARGET_ROLE, is_active: form.is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Sales Executive added', variant: 'success' })
      setShowCreate(false)
      setForm({ name: '', email: '', is_active: true })
    },
    onError: () => toast({ title: 'Create failed', variant: 'destructive' }),
  })

  const filtered = (users ?? []).filter((u: User) =>
    u.role === TARGET_ROLE &&
    (u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase()))
  )

  useEffect(() => {
    onResultCountChange?.(filtered.length)
  }, [filtered.length, onResultCountChange])

  const clientList: Client[] = clients ?? []
  const cases: Case[] = casesPage?.items ?? []

  const assignedClientsFor = (userId: string) => clientList.filter((c) => c.created_by === userId)
  const openCasesFor = (userId: string) => {
    const clientIds = new Set(assignedClientsFor(userId).map((c) => c.id))
    return cases.filter((c) => clientIds.has(c.client_id) && isOpen(c)).length
  }

  return (
    <div className="space-y-4">
      <Button className="hidden" onClick={() => setShowCreate(true)}>
        <PlusCircle className="h-4 w-4" /> Add Sales Executive
      </Button>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Briefcase} title={query ? `No results found for "${query}"` : 'No account managers found'} />
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Sales Executive</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Years of Experience</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assigned Clients</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Open Cases</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Joined Date</th>
                <th className="px-4 py-3" />
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
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <IdCard className="h-3 w-3 shrink-0" />
                          {u.employee_id ?? '—'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0" />
                      {u.years_of_experience != null ? `${u.years_of_experience} yr${u.years_of_experience === 1 ? '' : 's'}` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3 shrink-0" />
                      {assignedClientsFor(u.id).length}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    <span className="flex items-center gap-1">
                      <Ticket className="h-3 w-3 shrink-0" />
                      {openCasesFor(u.id)}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3 shrink-0" />
                      {formatDate(u.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/users/${u.id}`)}
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setForm({ name: '', email: '', is_active: true }) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Sales Executive</DialogTitle></DialogHeader>
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
              {createMutation.isPending ? 'Creating...' : 'Add Sales Executive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}