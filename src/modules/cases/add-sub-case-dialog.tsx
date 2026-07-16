'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { canAssignSubCaseEngineer, ROLE_LABELS } from '@/lib/rbac'
import { X, UserPlus } from 'lucide-react'
import type { Case, User } from '@/types'

export function AddSubCaseDialog({
  parentCase, open, onOpenChange,
}: {
  parentCase: Case
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }
  const canAssign = canAssignSubCaseEngineer(session.role)

  // The caller mounts this dialog only while `open` is true (see
  // SubCasesSection), so every open is a fresh instance — these initializers
  // seed the form instead of an effect.
  const [form, setForm] = useState({ title: '', description: '' })
  // Pre-select the parent's current assignee (if any) — TH/TL can add more or clear it.
  const [engineerIds, setEngineerIds] = useState<string[]>(parentCase.assignee_id ? [parentCase.assignee_id] : [])

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers(), enabled: canAssign })

  const eligibleEngineers = (users ?? []).filter((u) => ['support_engineer', 'team_lead'].includes(u.role) && u.is_active)
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))
  const selectedEngineers = engineerIds.map((id) => usersMap[id]).filter(Boolean)
  const availableEngineers = eligibleEngineers.filter((u) => !engineerIds.includes(u.id))

  const createM = useMutation({
    mutationFn: () =>
      dp.createSubCase(
        parentCase.id,
        {
          title: form.title.trim(),
          description: form.description.trim(),
          // Support engineers keep the old behaviour (inherit the case's
          // assignee); TH/TL get to pick who the sub task actually goes to,
          // including nobody at all.
          assignee_id: canAssign ? engineerIds[0] : parentCase.assignee_id,
          co_assignee_ids: canAssign && engineerIds.length > 1 ? engineerIds.slice(1) : undefined,
        },
        scope,
      ),
    onSuccess: (sub) => {
      qc.invalidateQueries({ queryKey: ['sub-cases', parentCase.id] })
      qc.invalidateQueries({ queryKey: ['cases'] })
      qc.invalidateQueries({ queryKey: ['case', parentCase.id] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast({ title: `Sub task ${sub.reference_no} created`, variant: 'success' })
      onOpenChange(false)
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  const valid = form.title.trim().length >= 3

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Add Sub Task
            <span className="text-muted-foreground font-normal text-sm ml-1">· under {parentCase.reference_no}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="sub-title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="sub-title"
              placeholder="Brief summary of the work item"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-desc">Short Description</Label>
            <Textarea
              id="sub-desc"
              rows={4}
              placeholder="Add a short description (optional)…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {canAssign && (
            <div className="space-y-1.5">
              <Label>Assign Support Engineer(s) <span className="text-muted-foreground font-normal">(optional)</span></Label>

              {selectedEngineers.length > 0 && (
                <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2">
                  {selectedEngineers.map((eng) => (
                    <div key={eng.id} className="flex items-center gap-2">
                      <UserAvatar name={eng.name} avatarUrl={eng.avatar} userId={eng.id} size="sm" border={false} shadow={false} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{eng.name}</p>
                        <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[eng.role] ?? eng.role}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEngineerIds((ids) => ids.filter((id) => id !== eng.id))}
                        className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {availableEngineers.length > 0 && (
                <Select value="" onValueChange={(uid) => setEngineerIds((ids) => [...ids, uid])}>
                  <SelectTrigger className="h-9 text-sm">
                    <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder={selectedEngineers.length ? 'Add another engineer…' : 'Select engineer(s)…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEngineers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[11px] text-muted-foreground">Leave empty to create the sub task unassigned.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid || createM.isPending} onClick={() => createM.mutate()}>
            {createM.isPending ? 'Creating…' : 'Create Sub Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
