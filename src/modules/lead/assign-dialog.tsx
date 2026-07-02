'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { UserCheck } from 'lucide-react'
import type { Case, User } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  caseData: Case | null
  engineers: User[]
}

export function AssignDialog({ open, onOpenChange, caseData, engineers }: Props) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [engineerId, setEngineerId] = useState('')

  useEffect(() => {
    if (open) setEngineerId(caseData?.assignee_id ?? '')
  }, [open, caseData])

  const assignMutation = useMutation({
    mutationFn: () => dp.assignCase(caseData!.id, engineerId, scope),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['cases'] })
      qc.invalidateQueries({ queryKey: ['case', caseData!.id] })
      const isReassign = !!caseData?.assignee_id && caseData.assignee_id !== engineerId
      toast({
        title: isReassign ? 'Case reassigned' : 'Case assigned',
        description: `${updated.reference_no} → ${engineers.find((e) => e.id === engineerId)?.name ?? engineerId}`,
        variant: 'success',
      })
      onOpenChange(false)
    },
    onError: () => toast({ title: 'Failed to assign', variant: 'destructive' }),
  })

  if (!caseData) return null

  const currentEngineer = engineers.find((e) => e.id === caseData.assignee_id)
  const isReassign = !!caseData.assignee_id

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            {isReassign ? 'Reassign Case' : 'Assign Case'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <span className="font-mono text-xs text-muted-foreground">{caseData.reference_no}</span>
            <p className="font-medium mt-0.5 line-clamp-2">{caseData.title}</p>
          </div>

          {currentEngineer && (
            <p className="text-sm text-muted-foreground">
              Currently assigned to <span className="font-medium text-foreground">{currentEngineer.name}</span>
            </p>
          )}

          <div className="space-y-1.5">
            <Label>Engineer <span className="text-destructive">*</span></Label>
            <Select value={engineerId} onValueChange={setEngineerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an engineer…" />
              </SelectTrigger>
              <SelectContent>
                {engineers.filter((e) => e.is_active).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                    {e.id === caseData.assignee_id && ' (current)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={!engineerId || engineerId === caseData.assignee_id || assignMutation.isPending}
          >
            {assignMutation.isPending ? 'Assigning…' : isReassign ? 'Reassign' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}