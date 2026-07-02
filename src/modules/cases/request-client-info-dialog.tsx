'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { CLIENT_INFO_REASON_LABELS } from '@/lib/utils'
import { HelpCircle } from 'lucide-react'
import type { ClientInfoReason } from '@/types'

// "Request Client Information" — engineer picks a reason category and adds an
// optional message; the case moves to Pending Client and the client is prompted.
export function RequestClientInfoDialog({
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

  const [reason, setReason] = useState<ClientInfoReason | ''>('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (open) { setReason(''); setMessage('') }
  }, [open])

  const requestM = useMutation({
    mutationFn: () => dp.requestClientInfo(caseId, scope, reason as ClientInfoReason, message.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['case', caseId] })
      qc.invalidateQueries({ queryKey: ['cases'] })
      qc.invalidateQueries({ queryKey: ['comments', caseId] })
      qc.invalidateQueries({ queryKey: ['audit-logs-case', caseId] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast({ title: 'Information requested from client', variant: 'success' })
      onOpenChange(false)
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-amber-600" /> Request Client Information
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>What do you need? <span className="text-destructive">*</span></Label>
            <Select value={reason} onValueChange={(v) => setReason(v as ClientInfoReason)}>
              <SelectTrigger><SelectValue placeholder="Select a reason…" /></SelectTrigger>
              <SelectContent>
                {(Object.entries(CLIENT_INFO_REASON_LABELS) as [ClientInfoReason, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rci-msg">Message to client</Label>
            <Textarea id="rci-msg" rows={3} placeholder="Explain exactly what is needed (optional)…" value={message}
              onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!reason || requestM.isPending} onClick={() => requestM.mutate()}>
            {requestM.isPending ? 'Sending…' : 'Request Information'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
