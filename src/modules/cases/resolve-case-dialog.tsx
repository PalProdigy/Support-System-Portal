'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { CheckCircle2 } from 'lucide-react'

// "Mark Resolved" — captures the required resolution details (spec: Root Cause,
// Resolution Summary, Solution, Resolution Notes) before moving the case to Resolved.
export function ResolveCaseDialog({
  caseId, open, onOpenChange,
}: {
  caseId: string
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [form, setForm] = useState({ root_cause: '', resolution_summary: '', solution: '', notes: '' })

  useEffect(() => {
    if (open) setForm({ root_cause: '', resolution_summary: '', solution: '', notes: '' })
  }, [open])

  const resolveM = useMutation({
    mutationFn: () =>
      dp.resolveCase(caseId, scope, {
        root_cause: form.root_cause.trim(),
        resolution_summary: form.resolution_summary.trim(),
        solution: form.solution.trim(),
        notes: form.notes.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['case', caseId] })
      qc.invalidateQueries({ queryKey: ['cases'] })
      qc.invalidateQueries({ queryKey: ['audit-logs-case', caseId] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['rca', caseId] })
      toast({ title: 'Case marked resolved', variant: 'success' })
      onOpenChange(false)
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  const valid = form.root_cause.trim() && form.resolution_summary.trim() && form.solution.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Mark Resolved
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="res-root">Root Cause <span className="text-destructive">*</span></Label>
            <Textarea id="res-root" rows={2} placeholder="What caused the issue?" value={form.root_cause}
              onChange={(e) => setForm((f) => ({ ...f, root_cause: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-summary">Resolution Summary <span className="text-destructive">*</span></Label>
            <Textarea id="res-summary" rows={2} placeholder="How was it resolved?" value={form.resolution_summary}
              onChange={(e) => setForm((f) => ({ ...f, resolution_summary: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-solution">Solution <span className="text-destructive">*</span></Label>
            <Textarea id="res-solution" rows={2} placeholder="The applied solution / fix" value={form.solution}
              onChange={(e) => setForm((f) => ({ ...f, solution: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-notes">Resolution Notes</Label>
            <Textarea id="res-notes" rows={2} placeholder="Any follow-up notes or prevention steps (optional)" value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid || resolveM.isPending} onClick={() => resolveM.mutate()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {resolveM.isPending ? 'Resolving…' : 'Mark Resolved'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
