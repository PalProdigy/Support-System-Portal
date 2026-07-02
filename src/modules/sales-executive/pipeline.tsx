'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { canAccess } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { ProspectDialog } from './prospect-dialog'
import { CreateClientDialog } from './create-client-dialog'
import { toast } from '@/hooks/use-toast'
import { PlusCircle, Pencil, Trash2, ArrowRight, TrendingUp } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { Prospect, ProspectStage } from '@/types'

const STAGES: { key: ProspectStage; label: string; color: string; dot: string }[] = [
  { key: 'discovery',   label: 'Discovery',   color: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',   dot: 'bg-blue-500' },
  { key: 'proposal',    label: 'Proposal',    color: 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800', dot: 'bg-violet-500' },
  { key: 'negotiation', label: 'Negotiation', color: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',  dot: 'bg-amber-500' },
  { key: 'closed_won',  label: 'Closed Won',  color: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' },
  { key: 'closed_lost', label: 'Closed Lost', color: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',   dot: 'bg-red-500' },
]

function fmt(n: number) {
  return n >= 1_000_000 ? `৳${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `৳${(n / 1_000).toFixed(0)}K` : `৳${n}`
}

export function Pipeline() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Prospect | null>(null)
  const [converting, setConverting] = useState<Prospect | null>(null)

  const { data: prospects, isLoading } = useQuery({
    queryKey: ['prospects', session.userId],
    queryFn: () => dp.listProspects(scope),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dp.deleteProspect(id, scope),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['prospects'] }); toast({ title: 'Prospect removed', variant: 'success' }) },
    onError: () => toast({ title: 'Failed to remove', variant: 'destructive' }),
  })

  const canManage = canAccess(scope, 'manage_prospects', 'prospect')
  const canConvert = canAccess(scope, 'create_client_account', 'prospect')

  const grouped = useMemo(() => {
    const map = new Map<ProspectStage, Prospect[]>()
    STAGES.forEach(({ key }) => map.set(key, []))
    ;(prospects ?? []).forEach((p) => map.get(p.stage)?.push(p))
    return map
  }, [prospects])

  const totalPipeline = (prospects ?? [])
    .filter((p) => !['closed_won', 'closed_lost'].includes(p.stage))
    .reduce((sum, p) => sum + (p.estimated_value ?? 0), 0)

  if (isLoading) return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />)}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span>Pipeline value: <strong className="text-foreground">{fmt(totalPipeline)}</strong></span>
          </div>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-sm text-muted-foreground">{(prospects ?? []).filter((p) => !['closed_won', 'closed_lost'].includes(p.stage)).length} active prospects</span>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <PlusCircle className="h-4 w-4" /> Add Prospect
          </Button>
        )}
      </div>

      {(prospects ?? []).length === 0 ? (
        <EmptyState icon={TrendingUp} title="No prospects yet" description="Start building your pipeline." action={canManage ? { label: 'Add Prospect', onClick: () => setShowCreate(true) } : undefined} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
          {STAGES.map(({ key, label, color, dot }) => {
            const items = grouped.get(key) ?? []
            return (
              <div key={key} className={cn('rounded-xl border p-3 space-y-2', color)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full shrink-0', dot)} />
                    <span className="text-xs font-semibold text-foreground">{label}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] h-4">{items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Empty</p>
                  )}
                  {items.map((p) => (
                    <div key={p.id} className="rounded-lg border bg-card p-3 shadow-sm space-y-2">
                      <p className="text-sm font-semibold leading-tight">{p.company_name}</p>
                      <p className="text-xs text-muted-foreground">{p.contact_person}</p>
                      {p.estimated_value && (
                        <p className="text-xs font-medium text-primary">{fmt(p.estimated_value)}</p>
                      )}
                      {p.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{p.notes}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">Updated {formatDate(p.updated_at)}</p>
                      {canManage && (
                        <div className="flex gap-1 pt-0.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(p)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => {
                            if (confirm(`Remove ${p.company_name}?`)) deleteMutation.mutate(p.id)
                          }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          {canConvert && key !== 'closed_won' && key !== 'closed_lost' && !p.converted_client_id && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-600 hover:text-emerald-700 ml-auto" title="Convert to client" onClick={() => setConverting(p)}>
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                      {p.converted_client_id && (
                        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">✓ Converted</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ProspectDialog open={showCreate} onOpenChange={setShowCreate} />
      <ProspectDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} editing={editing} />
      <CreateClientDialog open={!!converting} onOpenChange={(o) => !o && setConverting(null)} prefill={converting} />
    </div>
  )
}