'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { toast } from '@/hooks/use-toast'
import { Lightbulb, PlusCircle, Pencil } from 'lucide-react'
import { canAccess } from '@/lib/rbac'
import type { Solution } from '@/types'

export default function SolutionsPage() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Solution | null>(null)
  const [form, setForm] = useState({ name: '', description: '', details: '', category: '', is_active: true })

  const { data: solutions, isLoading } = useQuery({ queryKey: ['solutions'], queryFn: () => dp.listSolutions() })

  const canManage = canAccess(scope, 'manage_solutions', 'solution')

  const createMutation = useMutation({
    mutationFn: () => dp.createSolution(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solutions'] }); toast({ title: 'Solution created', variant: 'success' }); setShowCreate(false); setForm({ name: '', description: '', details: '', category: '', is_active: true }) },
    onError: () => toast({ title: 'Failed', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: (s: Solution) => dp.updateSolution(s.id, s),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solutions'] }); toast({ title: 'Solution updated', variant: 'success' }); setEditing(null) },
    onError: () => toast({ title: 'Failed', variant: 'destructive' }),
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Solutions</h1><p className="text-sm text-muted-foreground">{solutions?.length ?? 0} products/services</p></div>
        {canManage && <Button onClick={() => setShowCreate(true)}><PlusCircle className="h-4 w-4" /> Add Solution</Button>}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : (solutions ?? []).length === 0 ? (
        <EmptyState icon={Lightbulb} title="No solutions" />
      ) : (
        <div className="space-y-3">
          {(solutions ?? []).map((s: Solution) => (
            <div key={s.id} className="rounded-xl border bg-card p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="rounded-lg bg-primary/10 p-2.5 mt-0.5"><Lightbulb className="h-4 w-4 text-primary" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{s.name}</p>
                    {!s.is_active && <span className="text-xs text-muted-foreground">(inactive)</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.category}</p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                </div>
              </div>
              {canManage && (
                <Button variant="ghost" size="icon" onClick={() => setEditing({ ...s })}><Pencil className="h-3.5 w-3.5" /></Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Solution</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. CRM, Integration" /></div>
            <div className="space-y-1.5"><Label>Short Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="space-y-1.5"><Label>Full Details</Label><Textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} rows={4} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={createMutation.isPending || !form.name} onClick={() => createMutation.mutate()}>{createMutation.isPending ? 'Saving...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      {editing && (
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Solution</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Category</Label><Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Short Description</Label><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} /></div>
              <div className="space-y-1.5"><Label>Full Details</Label><Textarea value={editing.details} onChange={(e) => setEditing({ ...editing, details: e.target.value })} rows={4} /></div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Active</Label></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate(editing)}>{updateMutation.isPending ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}