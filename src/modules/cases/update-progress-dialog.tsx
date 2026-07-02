'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { canAccess } from '@/lib/rbac'
import { Activity } from 'lucide-react'

// "Update Progress" — a temporary progress note posted as a comment. Does NOT
// change case status, so it never creates a progress-timeline step.
export function UpdateProgressDialog({
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
  const canInternal = canAccess(scope, 'create', 'internal_comment')

  const [body, setBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)

  useEffect(() => {
    if (open) { setBody(''); setIsInternal(false) }
  }, [open])

  const postM = useMutation({
    mutationFn: () => dp.addComment(
      { case_id: caseId, author_id: session.userId, body: body.trim(), is_internal: isInternal, parent_id: null },
      scope,
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', caseId] })
      qc.invalidateQueries({ queryKey: ['case', caseId] })
      toast({ title: 'Progress update posted', variant: 'success' })
      onOpenChange(false)
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" /> Update Progress
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="up-body">Progress note <span className="text-destructive">*</span></Label>
            <Textarea id="up-body" rows={4} placeholder="What's the latest on this case?" value={body}
              onChange={(e) => setBody(e.target.value)} />
          </div>
          {canInternal && (
            <div className="flex items-center gap-2">
              <Switch id="up-internal" checked={isInternal} onCheckedChange={setIsInternal} />
              <Label htmlFor="up-internal" className="text-sm cursor-pointer">Internal note (not visible to client)</Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={body.trim().length < 2 || postM.isPending} onClick={() => postM.mutate()}>
            {postM.isPending ? 'Posting…' : 'Post Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
