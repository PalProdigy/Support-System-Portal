'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { canAccess } from '@/lib/rbac'
import { UserCog, Check, X } from 'lucide-react'
import type { EngineerChangeRequest, User } from '@/types'

// Panel shown to Team Lead / Technical Head when a client has requested an
// engineer change. Shows the current engineer + reason and lets them approve
// (choosing a new engineer) or reject. The case stays In Progress throughout.
export function EngineerChangePanel({
  request, caseId, usersMap, engineers,
}: {
  request: EngineerChangeRequest
  caseId: string
  usersMap: Record<string, User>
  engineers: User[]
}) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }
  const canDecide = canAccess(scope, 'assign', 'case')

  const [newEngineerId, setNewEngineerId] = useState('')

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['case', caseId] })
    qc.invalidateQueries({ queryKey: ['cases'] })
    qc.invalidateQueries({ queryKey: ['engineer-change-requests', caseId] })
    qc.invalidateQueries({ queryKey: ['audit-logs-case', caseId] })
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  const approveM = useMutation({
    mutationFn: () => dp.approveEngineerChange(request.id, newEngineerId, scope),
    onSuccess: () => { invalidate(); toast({ title: 'Engineer change approved', variant: 'success' }) },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })
  const rejectM = useMutation({
    mutationFn: () => dp.rejectEngineerChange(request.id, scope),
    onSuccess: () => { invalidate(); toast({ title: 'Engineer change rejected', variant: 'success' }) },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  const currentEngineer = request.current_engineer_id ? usersMap[request.current_engineer_id] : undefined
  // Don't offer the current engineer as the replacement.
  const options = engineers.filter((u) => u.id !== request.current_engineer_id)

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UserCog className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Engineer Change Request</h3>
      </div>

      <div className="space-y-1 text-sm">
        <p><span className="text-muted-foreground">Current engineer:</span>{' '}
          <span className="font-medium">{currentEngineer?.name ?? 'Unassigned'}</span></p>
        <p><span className="text-muted-foreground">Requested reason:</span>{' '}
          <span className="text-foreground">{request.reason}</span></p>
      </div>

      {canDecide ? (
        <div className="space-y-2 pt-1">
          <Select value={newEngineerId} onValueChange={setNewEngineerId}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select a new engineer…" /></SelectTrigger>
            <SelectContent>
              {options.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" disabled={!newEngineerId || approveM.isPending}
              onClick={() => approveM.mutate()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Check className="h-3.5 w-3.5" /> {approveM.isPending ? 'Approving…' : 'Approve Change'}
            </Button>
            <Button size="sm" variant="outline" disabled={rejectM.isPending}
              onClick={() => rejectM.mutate()}>
              <X className="h-3.5 w-3.5" /> {rejectM.isPending ? 'Rejecting…' : 'Reject Change'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Awaiting a Team Lead / Technical Head decision.</p>
      )}
    </div>
  )
}
