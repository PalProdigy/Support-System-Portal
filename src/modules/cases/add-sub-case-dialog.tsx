'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import type { Case } from '@/types'

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

  const [form, setForm] = useState({ title: '', description: '' })

  useEffect(() => {
    if (open) setForm({ title: '', description: '' })
  }, [open])

  const createM = useMutation({
    mutationFn: () =>
      dp.createSubCase(
        parentCase.id,
        {
          title: form.title.trim(),
          description: form.description.trim(),
          // Inherit the case's support engineer so the sub task shows a name.
          assignee_id: parentCase.assignee_id,
        },
        scope,
      ),
    onSuccess: (sub) => {
      qc.invalidateQueries({ queryKey: ['sub-cases', parentCase.id] })
      qc.invalidateQueries({ queryKey: ['cases'] })
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
