'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, Building2, Package, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Solution, Prospect } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  prefill?: Prospect | null
}

const STEPS = ['Company Info', 'Assign Solutions', 'Review'] as const

export function CreateClientDialog({ open, onOpenChange, prefill }: Props) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    company_name: '',
    contact_person: '',
    phone: '',
    business_context: '',
    pre_sales_notes: '',
    solution_ids: [] as string[],
  })

  const reset = useCallback(() => {
    setStep(0)
    setForm({ company_name: '', contact_person: '', phone: '', business_context: '', pre_sales_notes: '', solution_ids: [] })
  }, [])

  // Pre-fill from prospect when dialog opens
  useState(() => {
    if (prefill && open) {
      setForm((f) => ({
        ...f,
        company_name: prefill.company_name,
        contact_person: prefill.contact_person,
        phone: prefill.phone,
        business_context: prefill.business_context,
        pre_sales_notes: prefill.notes ?? '',
      }))
    }
  })

  const { data: solutions } = useQuery({
    queryKey: ['solutions'],
    queryFn: () => dp.listSolutions(),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      dp.createClientAccount({
        company_name: form.company_name,
        contact_person: form.contact_person,
        phone: form.phone,
        business_context: form.business_context,
        pre_sales_notes: form.pre_sales_notes || undefined,
        solution_ids: form.solution_ids,
        prospect_id: prefill?.id,
      }, scope),
    onSuccess: ({ client }) => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['prospects'] })
      toast({ title: `Client account created for ${client.company_name}`, variant: 'success' })
      onOpenChange(false)
      reset()
      router.push(`/clients/${client.id}`)
    },
    onError: () => toast({ title: 'Failed to create client account', variant: 'destructive' }),
  })

  const toggleSolution = (id: string) => {
    setForm((f) => ({
      ...f,
      solution_ids: f.solution_ids.includes(id)
        ? f.solution_ids.filter((s) => s !== id)
        : [...f.solution_ids, id],
    }))
  }

  const step0Valid = form.company_name && form.contact_person && form.phone && form.business_context
  const step1Valid = form.solution_ids.length > 0
  const canNext = step === 0 ? step0Valid : step === 1 ? step1Valid : true

  const activeSolutions = (solutions ?? []).filter((s: Solution) => s.is_active)
  const selectedSolutions = activeSolutions.filter((s: Solution) => form.solution_ids.includes(s.id))

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Client Account</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-4">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-1 flex-1">
              <div className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                i < step ? 'bg-primary text-primary-foreground' :
                i === step ? 'border-2 border-primary text-primary' :
                'border-2 border-muted text-muted-foreground'
              )}>
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className={cn('text-xs hidden sm:inline', i === step ? 'text-foreground font-medium' : 'text-muted-foreground')}>{label}</span>
              {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />}
            </div>
          ))}
        </div>

        {/* Step 0: Company Info */}
        {step === 0 && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Company Name <span className="text-destructive">*</span></Label>
              <Input value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} placeholder="Acme Distributors Ltd" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact Person <span className="text-destructive">*</span></Label>
                <Input value={form.contact_person} onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))} placeholder="Jane Doe" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone <span className="text-destructive">*</span></Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+880 17..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Business Context <span className="text-destructive">*</span></Label>
              <Textarea rows={3} value={form.business_context} onChange={(e) => setForm((f) => ({ ...f, business_context: e.target.value }))} placeholder="Why is this client a good fit? What problems are we solving?" />
            </div>
            <div className="space-y-1.5">
              <Label>Pre-sales Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea rows={2} value={form.pre_sales_notes} onChange={(e) => setForm((f) => ({ ...f, pre_sales_notes: e.target.value }))} placeholder="Deal history, pricing agreed, special requirements..." />
            </div>
          </div>
        )}

        {/* Step 1: Assign Solutions */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Select the solutions this client has purchased. At least one is required.</p>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {activeSolutions.map((s: Solution) => {
                const selected = form.solution_ids.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSolution(s.id)}
                    className={cn(
                      'w-full text-left rounded-lg border p-3 flex items-start gap-3 transition-colors',
                      selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
                    )}
                  >
                    <div className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', selected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40')}>
                      {selected && <Check className="h-2.5 w-2.5" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.category} · {s.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            {form.solution_ids.length > 0 && (
              <p className="text-xs text-primary font-medium">{form.solution_ids.length} solution{form.solution_ids.length > 1 ? 's' : ''} selected</p>
            )}
          </div>
        )}

        {/* Step 2: Review */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="h-4 w-4 text-primary" /> Client Account
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-muted-foreground">Company</span><span className="font-medium">{form.company_name}</span>
                <span className="text-muted-foreground">Contact</span><span>{form.contact_person}</span>
                <span className="text-muted-foreground">Phone</span><span>{form.phone}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{form.business_context}</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Package className="h-4 w-4 text-primary" /> Solutions ({selectedSolutions.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedSolutions.map((s) => (
                  <span key={s.id} className="rounded-full bg-primary/10 text-primary text-xs px-2.5 py-0.5 font-medium">{s.name}</span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Eye className="h-4 w-4 text-primary" /> What will be created
              </div>
              <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                <li>Client record for <strong>{form.company_name}</strong></li>
                <li>System user account linked to this client</li>
                <li>{selectedSolutions.length} solution assignment{selectedSolutions.length > 1 ? 's' : ''}</li>
                {prefill && <li>Prospect "{prefill.company_name}" marked as Closed Won</li>}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>Back</Button>
          )}
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>Cancel</Button>
          {step < 2 ? (
            <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? 'Creating…' : 'Create Client Account'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}