'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { Mail, X } from 'lucide-react'

interface ExternalMembersCardProps {
  caseId?: string
  projectId?: string
  /** View-only — hides the Add control and per-row Remove button (e.g. sales_executive). */
  readOnly?: boolean
}

// External email addresses (client-side stakeholder, vendor contact, etc.)
// CC'd on a Case or a Project — just the address, not an app User. Shared by
// case-detail.tsx and project-detail.tsx side panels.
export function ExternalMembersCard({ caseId, projectId, readOnly = false }: ExternalMembersCardProps) {
  const dp = getDataProvider()
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [email, setEmail] = useState('')

  const queryKey = ['external-members', caseId ?? '', projectId ?? '']
  const { data: members, isLoading } = useQuery({
    queryKey,
    queryFn: () => dp.listExternalMembers({ case_id: caseId, project_id: projectId }),
  })

  function resetForm() {
    setShowAdd(false)
    setEmail('')
  }

  const add = useMutation({
    mutationFn: () => dp.addExternalMember({
      case_id: caseId,
      project_id: projectId,
      email: email.trim(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      resetForm()
      toast({ title: 'External email added', variant: 'success' })
    },
    onError: () => toast({ title: 'Could not add external email', variant: 'destructive' }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => dp.deleteExternalMember(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      toast({ title: 'External email removed', variant: 'success' })
    },
    onError: () => toast({ title: 'Could not remove external email', variant: 'destructive' }),
  })

  const canSave = /\S+@\S+\.\S+/.test(email.trim())
  const list = members ?? []

  return (
    <div className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" /> External Email
        </h3>
        {!readOnly && !showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="text-[11px] font-medium text-primary hover:underline shrink-0"
          >
            + Add
          </button>
        )}
      </div>

      {!isLoading && list.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground">No external emails added.</p>
      )}

      {list.length > 0 && (
        <div className="space-y-1.5">
          {list.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-lg border px-2.5 py-2">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="min-w-0 flex-1 text-sm font-medium text-foreground truncate">{m.email}</p>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove.mutate(m.id)}
                  className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            type="email"
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && canSave) add.mutate() }}
          />
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" className="flex-1 h-8" disabled={!canSave || add.isPending} onClick={() => add.mutate()}>
              {add.isPending ? 'Adding…' : 'Add'}
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
