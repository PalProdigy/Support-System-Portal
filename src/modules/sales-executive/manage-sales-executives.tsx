'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/shared/user-avatar'
import { EmptyState } from '@/components/shared/empty-state'
import { IconField } from '@/components/shared/icon-field'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import {
  PlusCircle, Briefcase, Clock, Eye, IdCard, Trophy, CalendarDays, Camera,
  UserRound, Mail, Phone, ImageUp, UserPlus,
} from 'lucide-react'
import type { User, Role, Prospect } from '@/types'
import { useRouter } from 'next/navigation'
import { formatDate, formatBytes } from '@/lib/utils'
import { useSession } from '@/lib/auth/context'

const TARGET_ROLE: Role = 'sales_executive'
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
const EMPTY_FORM = { name: '', email: '', mobile: '', designation: '', employeeId: '', avatar: '', joiningDate: todayISODate(), is_active: true }

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
  const [form, setForm] = useState(EMPTY_FORM)
  const avatarRef = useRef<HTMLInputElement>(null)

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })

  // Technical Head sees every prospect, used below to derive per-sales-executive
  // "Successful Deals" (closed_won) counts without a query per row.
  const scope = { userId: session.userId, role: 'technical_head' as Role }
  const { data: prospects } = useQuery({ queryKey: ['prospects', 'th-all'], queryFn: () => dp.listProspects(scope) })

  const createMutation = useMutation({
    mutationFn: async () => {
      const created = await dp.createUser({
        name: form.name,
        email: form.email,
        role: TARGET_ROLE,
        department: 'sales',
        is_active: form.is_active,
        contact_numbers: form.mobile.trim() ? [form.mobile.trim()] : undefined,
        designation: form.designation.trim() || undefined,
        employee_id: form.employeeId.trim() || undefined,
        avatar: form.avatar || undefined,
      })
      // createUser always stamps created_at as "now" — overwrite it with the
      // chosen joining date so the "Joined Date" column reflects reality.
      if (form.joiningDate) {
        return dp.updateUser(created.id, { created_at: new Date(`${form.joiningDate}T00:00:00`).toISOString() })
      }
      return created
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Sales Executive added', variant: 'success' })
      setShowCreate(false)
      setForm(EMPTY_FORM)
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

  const filtered = (users ?? []).filter((u: User) =>
    u.role === TARGET_ROLE &&
    (u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase()))
  )

  useEffect(() => {
    onResultCountChange?.(filtered.length)
  }, [filtered.length, onResultCountChange])

  const prospectList: Prospect[] = prospects ?? []

  const successfulDealsFor = (userId: string) => prospectList.filter((p) => p.created_by === userId && p.stage === 'closed_won').length

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setForm((f) => ({ ...f, joiningDate: todayISODate() })); setShowCreate(true) }}>
          <PlusCircle className="h-4 w-4" /> Add Sales Executive
        </Button>
      </div>

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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground"># Successful Deals</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Years of Experience</th>
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
                    router.push(`/sales-executive/${u.id}`)
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                     <UserAvatar name={u.name} avatarUrl={u.avatar} userId={u.id} size="sm" border={false} shadow={false} />
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
                      <Trophy className="h-3 w-3 shrink-0" />
                      {successfulDealsFor(u.id)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0" />
                      {u.years_of_experience != null ? `${u.years_of_experience} yr${u.years_of_experience === 1 ? '' : 's'}` : '—'}
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
                      onClick={() => router.push(`/sales-executive/${u.id}`)}
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
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setForm(EMPTY_FORM) }}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          {/* Hero header */}
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-5">
            <DialogHeader className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/15 p-2.5 shrink-0">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle>Add Sales Executive</DialogTitle>
                  <DialogDescription>Create a new account manager profile</DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Avatar — centered hero upload */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <UserAvatar name={form.name || 'New Sales Executive'} avatarUrl={form.avatar} size="xl" border shadow />
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
                <ImageUp className="h-3 w-3" /> {form.avatar ? 'Change photo' : 'Upload photo'}
              </button>
              {form.avatar && (
                <button type="button" onClick={() => setForm({ ...form, avatar: '' })} className="text-xs text-muted-foreground hover:text-destructive">
                  Remove picture
                </button>
              )}
            </div>

            <div className="space-y-3">
              <IconField
                icon={UserRound}
                label="Full Name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
              />
              <IconField
                icon={Mail}
                label="Email"
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@company.com"
              />
              <div className="grid grid-cols-2 gap-3">
                <IconField
                  icon={Phone}
                  label="Mobile Number"
                  type="tel"
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  placeholder="+880 …"
                />
                <IconField
                  icon={Briefcase}
                  label="Designation"
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  placeholder="Account Manager"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <IconField
                  icon={IdCard}
                  label="Employee ID"
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  placeholder="EMP-1024"
                />
                <IconField
                  icon={CalendarDays}
                  label="Joining Date"
                  type="date"
                  value={form.joiningDate}
                  onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              className="gap-1.5"
              disabled={createMutation.isPending || !form.name || !form.email}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Creating…' : (<><PlusCircle className="h-4 w-4" /> Add Sales Executive</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}