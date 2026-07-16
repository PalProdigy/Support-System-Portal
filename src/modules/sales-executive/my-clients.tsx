'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { CreateClientDialog } from './create-client-dialog'
import { useRouter } from 'next/navigation'
import { Building2, PlusCircle, Ticket, AlertTriangle, ChevronRight, Pencil } from 'lucide-react'
import { cn, formatDate, slaPercent } from '@/lib/utils'
import type { Client, Case } from '@/types'

interface ClientRow {
  client: Client
  cases: Case[]
  openCount: number
  criticalCount: number
  breachedCount: number
}

export function MyClients() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [notes, setNotes] = useState('')

  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
  })

  const { data: casesPage } = useQuery({
    queryKey: ['cases', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 200 }),
    enabled: (clients ?? []).length > 0,
  })

  const { data: solutions } = useQuery({
    queryKey: ['solutions'],
    queryFn: () => dp.listSolutions(),
  })

  const { data: clientSolutions } = useQuery({
    queryKey: ['client-solutions'],
    queryFn: () => dp.listClientSolutions(),
  })

  const updateNotesMutation = useMutation({
    mutationFn: () => dp.updateClient(editingClient!.id, { business_context: notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast({ title: 'Notes updated', variant: 'success' })
      setEditingClient(null)
    },
    onError: () => toast({ title: 'Failed to update notes', variant: 'destructive' }),
  })

  const solutionsMap = useMemo(
    () => Object.fromEntries((solutions ?? []).map((s) => [s.id, s])),
    [solutions]
  )

  const rows: ClientRow[] = useMemo(() => {
    const allCases = casesPage?.items ?? []
    return (clients ?? [])
      .filter((c) => !query || c.company_name.toLowerCase().includes(query.toLowerCase()))
      .map((client) => {
        const cases = allCases.filter((c) => c.client_id === client.id)
        const openCases = cases.filter((c) => !['closed', 'resolved', 'pending_closure'].includes(c.status))
        const criticalCount = openCases.filter((c) => c.priority === 'critical').length
        const breachedCount = openCases.filter((c) => slaPercent(c.created_at, c.sla_due_at) >= 100).length
        return { client, cases, openCount: openCases.length, criticalCount, breachedCount }
      })
  }, [clients, casesPage, query])

  if (loadingClients) return (
    <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <SearchInput
          containerClassName="flex-1 max-w-xs"
          className="h-8 text-sm"
          placeholder="Search clients…"
          value={query}
          onChange={setQuery}
          aria-label="Search clients"
          resultCount={rows.length}
          resultLabel="client"
        />
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <PlusCircle className="h-4 w-4" /> New Client
        </Button>
      </div>

      {rows.length === 0 ? (
        query ? (
          <EmptyState icon={Building2} title={`No results found for "${query}"`} description="Try a different search term." />
        ) : (
          <EmptyState icon={Building2} title="No clients yet" description="Create your first client account to get started." action={{ label: 'Create Client Account', onClick: () => setShowCreate(true) }} />
        )
      ) : (
        <div className="space-y-3">
          {rows.map(({ client, cases, openCount, criticalCount, breachedCount }) => {
            const mySolutions = (clientSolutions ?? [])
              .filter((cs) => cs.client_id === client.id)
              .map((cs) => solutionsMap[cs.solution_id]?.name)
              .filter(Boolean)

            const recentOpenCases = cases
              .filter((c) => !['closed', 'resolved'].includes(c.status))
              .slice(0, 3)

            return (
              <div key={client.id} className="rounded-xl border bg-card p-4 space-y-3">
                {/* Client header */}
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
                    onClick={() => router.push(`/clients/${client.id}`)}
                  >
                    <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{client.company_name}</p>
                      <p className="text-sm text-muted-foreground">{client.contact_person} · {client.phone}</p>
                      {mySolutions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {mySolutions.map((name) => (
                            <span key={name} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit notes" onClick={() => { setEditingClient(client); setNotes(client.business_context) }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push(`/clients/${client.id}`)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Ticket className="h-3.5 w-3.5" />
                    <span>{openCount} open</span>
                  </span>
                  {criticalCount > 0 && (
                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {criticalCount} critical
                    </span>
                  )}
                  {breachedCount > 0 && (
                    <span className="text-red-600 dark:text-red-400 font-medium text-xs">
                      {breachedCount} SLA breach{breachedCount > 1 ? 'es' : ''}
                    </span>
                  )}
                </div>

                {/* Recent open cases */}
                {recentOpenCases.length > 0 && (
                  <div className="space-y-1.5 pl-1">
                    {recentOpenCases.map((c) => (
                      <div
                        key={c.id}
                        className={cn(
                          'flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer hover:bg-accent transition-colors',
                          slaPercent(c.created_at, c.sla_due_at) >= 100 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-muted/40'
                        )}
                        onClick={() => router.push(`/cases/${c.id}`)}
                      >
                        <span className="font-mono text-muted-foreground shrink-0">{c.reference_no}</span>
                        <span className="flex-1 truncate">{c.title}</span>
                        <StatusBadge status={c.status} size="sm" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Business context notes */}
                <p className="text-xs text-muted-foreground line-clamp-2 border-t pt-2 mt-1">
                  <span className="font-medium text-foreground/70">Context: </span>{client.business_context}
                </p>
                <p className="text-[10px] text-muted-foreground">Client since {formatDate(client.created_at)}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit notes dialog */}
      {editingClient && (
        <Dialog open={!!editingClient} onOpenChange={(o) => !o && setEditingClient(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Business Context Notes</DialogTitle></DialogHeader>
            <div className="space-y-1.5 py-1">
              <Label>Notes for {editingClient.company_name} <span className="text-xs text-muted-foreground">(visible to all staff)</span></Label>
              <Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add context, history, or special requirements..." />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingClient(null)}>Cancel</Button>
              <Button onClick={() => updateNotesMutation.mutate()} disabled={updateNotesMutation.isPending}>
                {updateNotesMutation.isPending ? 'Saving…' : 'Save Notes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <CreateClientDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  )
}