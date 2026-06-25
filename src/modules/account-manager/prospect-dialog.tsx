'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import type { Prospect, ProspectStage } from '@/types'

const STAGE_LABELS: Record<ProspectStage, string> = {
  discovery: 'Discovery',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  editing?: Prospect | null
}

const EMPTY = {
  company_name: '', contact_person: '', phone: '', email: '',
  business_context: '', stage: 'discovery' as ProspectStage,
  notes: '', estimated_value: '',
}

export function ProspectDialog({ open, onOpenChange, editing }: Props) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [form, setForm] = useState(EMPTY)
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }))

  useEffect(() => {
    if (editing) {
      setForm({
        company_name: editing.company_name,
        contact_person: editing.contact_person,
        phone: editing.phone,
        email: editing.email ?? '',
        business_context: editing.business_context,
        stage: editing.stage,
        notes: editing.notes ?? '',
        estimated_value: editing.estimated_value?.toString() ?? '',
      })
    } else {
      setForm(EMPTY)
    }
  }, [editing, open])

  const createMutation = useMutation({
    mutationFn: () =>
      dp.createProspect({
        company_name: form.company_name,
        contact_person: form.contact_person,
        phone: form.phone,
        email: form.email || undefined,
        business_context: form.business_context,
        stage: form.stage,
        notes: form.notes || undefined,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : undefined,
        created_by: session.userId,
      }, scope),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prospects'] })
      toast({ title: 'Prospect added', variant: 'success' })
      onOpenChange(false)
    },
    onError: () => toast({ title: 'Failed to add prospect', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      dp.updateProspect(editing!.id, {
        company_name: form.company_name,
        contact_person: form.contact_person,
        phone: form.phone,
        email: form.email || undefined,
        business_context: form.business_context,
        stage: form.stage,
        notes: form.notes || undefined,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : undefined,
      }, scope),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prospects'] })
      toast({ title: 'Prospect updated', variant: 'success' })
      onOpenChange(false)
    },
    onError: () => toast({ title: 'Failed to update prospect', variant: 'destructive' }),
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const isValid = form.company_name && form.contact_person && form.phone && form.business_context

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Prospect' : 'Add Prospect'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Company Name <span className="text-destructive">*</span></Label>
              <Input value={form.company_name} onChange={(e) => set({ company_name: e.target.value })} placeholder="Acme Corp" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Person <span className="text-destructive">*</span></Label>
              <Input value={form.contact_person} onChange={(e) => set({ contact_person: e.target.value })} placeholder="Jane Doe" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone <span className="text-destructive">*</span></Label>
              <Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+880 17..." />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="contact@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={(v) => set({ stage: v as ProspectStage })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(STAGE_LABELS) as [ProspectStage, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Est. Value (BDT)</Label>
              <Input type="number" value={form.estimated_value} onChange={(e) => set({ estimated_value: e.target.value })} placeholder="500000" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Business Context <span className="text-destructive">*</span></Label>
              <Textarea value={form.business_context} onChange={(e) => set({ business_context: e.target.value })} rows={3} placeholder="What problem are they trying to solve?" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes (visible to staff)</Label>
              <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} placeholder="Internal notes for the team..." />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!isValid || isPending}
            onClick={() => editing ? updateMutation.mutate() : createMutation.mutate()}
          >
            {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Prospect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}