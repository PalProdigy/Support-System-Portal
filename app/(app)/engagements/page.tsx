'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { EmptyState } from '@/components/shared/empty-state'
import { StatCard } from '@/components/shared/stat-card'
import { SearchableSelect } from '@/components/shared/searchable-select'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchInput } from '@/components/ui/search-input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from '@/hooks/use-toast'
import { cn, formatDate } from '@/lib/utils'
import { loadOemOptions } from '@/lib/products-shared'
import {
  Handshake, PlusCircle, Building2, Calendar, Trash2, X, Pencil,
  Wrench, FlaskConical, LifeBuoy, Hash, Package, UserPlus, UserCircle2, AlertTriangle,
  Users, CheckCircle2, FolderKanban, ChevronsUpDown, Check,
} from 'lucide-react'
import type { Engagement, EngagementType, EngagementProductLine, Client, ClientContact, Product, Team, User } from '@/types'

const ENGAGEMENT_TYPES: EngagementType[] = ['installation', 'poc', 'support']

const TYPE_LABELS: Record<EngagementType, string> = {
  installation: 'Installation',
  poc: 'POC',
  support: 'Support',
}

const TYPE_ICONS: Record<EngagementType, typeof Wrench> = {
  installation: Wrench,
  poc: FlaskConical,
  support: LifeBuoy,
}

const TYPE_COLORS: Record<EngagementType, string> = {
  installation: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  poc: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  support: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

// Every engagement is always in this one state — see EngagementStatus.
const WAITING_LABEL = 'Waiting for Client Creation'
const WAITING_BADGE = 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-600'
const WAITING_ACCENT = 'bg-slate-300'

// Left accent bar per product type, used on the nested product cards.
const TYPE_ACCENT: Record<EngagementType, string> = {
  installation: 'bg-blue-400',
  poc: 'bg-violet-400',
  support: 'bg-emerald-400',
}

const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`

export default function EngagementsPage() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const isAM = session.role === 'sales_executive'
  const isTH = session.role === 'technical_head'

  const [nowMs] = useState(() => Date.now())
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Engagement | null>(null)
  const [deleting, setDeleting] = useState<Engagement | null>(null)
  const [assigningLine, setAssigningLine] = useState<{ engagementId: string; line: EngagementProductLine } | null>(null)

  const { data: engagements, isLoading } = useQuery({
    queryKey: ['engagements', session.userId, session.role],
    queryFn: () => dp.listEngagements(scope),
  })

  const { data: clients } = useQuery({ queryKey: ['clients', session.userId], queryFn: () => dp.listClients(scope) })
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => dp.listProducts() })
  const { data: contacts } = useQuery({ queryKey: ['client-contacts'], queryFn: () => dp.listClientContacts() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })

  const clientsMap = Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c]))
  const productsMap = Object.fromEntries((products ?? []).map((p: Product) => [p.id, p]))
  const contactsMap = Object.fromEntries((contacts ?? []).map((c: ClientContact) => [c.id, c]))
  const teamsMap = Object.fromEntries((teams ?? []).map((t: Team) => [t.id, t]))
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dp.deleteEngagement(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engagements'] })
      toast({ title: 'Order deleted', variant: 'success' })
      setDeleting(null)
    },
    onError: () => toast({ title: 'Failed to delete order', variant: 'destructive' }),
  })

  const all = engagements ?? []
  const q = search.trim().toLowerCase()
  const filtered = all
    .filter((e) => typeFilter === 'all' || e.products.some((p) => p.types.includes(typeFilter as EngagementType)))
    .filter((e) => {
      if (!q) return true
      const client = clientsMap[e.client_id]
      return (
        (client?.company_name ?? '').toLowerCase().includes(q) ||
        (e.customer_po ?? '').toLowerCase().includes(q) ||
        e.products.some((p) =>
          p.oem.toLowerCase().includes(q) ||
          (productsMap[p.product_id]?.name ?? '').toLowerCase().includes(q)
        )
      )
    })

  const allProductLines = all.flatMap((e) => e.products)
  const totalCount = all.length
  const installCount = allProductLines.filter((p) => p.types.includes('installation')).length
  const pocCount = allProductLines.filter((p) => p.types.includes('poc')).length
  const supportCount = allProductLines.filter((p) => p.types.includes('support')).length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Hero header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-primary/15 p-3 shrink-0">
            <Handshake className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Orders</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{totalCount} order{totalCount !== 1 ? 's' : ''} tracked</p>
          </div>
        </div>
        {isAM && (
          <Button onClick={() => setShowCreate(true)}>
            <PlusCircle className="h-4 w-4" /> New Order
          </Button>
        )}
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total" value={totalCount} icon={Handshake} loading={isLoading} />
        <StatCard title="Installations" value={installCount} icon={Wrench} iconColor="text-blue-500" loading={isLoading} />
        <StatCard title="POCs" value={pocCount} icon={FlaskConical} iconColor="text-violet-500" loading={isLoading} />
        <StatCard title="Support" value={supportCount} icon={LifeBuoy} iconColor="text-emerald-500" loading={isLoading} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <SearchInput
          containerClassName="flex-1 min-w-48"
          className="h-9"
          placeholder="Search by client, OEM, product, PO…"
          value={search}
          onChange={setSearch}
          debounceMs={250}
          aria-label="Search orders"
          resultCount={filtered.length}
          resultLabel="order"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {ENGAGEMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title={search ? `No results found for "${search}"` : 'No orders found'}
          description={typeFilter !== 'all' || search ? 'Try adjusting your filters.' : 'Click "New Order" to set one up.'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => {
            const client = clientsMap[e.client_id]
            const hasExpired = e.products.some((p) => p.expires_at && new Date(p.expires_at).getTime() < nowMs)
            return (
              <div
                key={e.id}
                className="group flex items-stretch gap-0 rounded-xl border bg-card overflow-hidden transition-all hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className={cn('w-1.5 shrink-0', hasExpired ? 'bg-red-400' : WAITING_ACCENT)} />

                <div className="flex-1 min-w-0 flex items-start gap-3.5 p-4">
                  <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
                    <Handshake className="h-5 w-5 text-primary" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-semibold text-foreground truncate">
                        {client ? client.company_name : 'Order'}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasExpired && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-400 px-2.5 py-1 text-[11px] font-semibold">
                            <AlertTriangle className="h-3 w-3" /> Expired
                          </span>
                        )}
                        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold', WAITING_BADGE)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', WAITING_ACCENT)} />
                          {WAITING_LABEL}
                        </span>
                        {isAM && (
                          <>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setEditing(e)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setDeleting(e)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {e.customer_po && (
                        <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          <Hash className="h-3 w-3" /> {e.customer_po}
                        </span>
                      )}
                      <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        <Calendar className="h-3 w-3" /> {formatDate(e.created_at)}
                      </span>
                    </div>

                    {e.products.length > 0 && (
                      <div className="space-y-2 mt-3 pt-3 border-t">
                        {e.products.map((line) => {
                          const lineTypes = line.types.length > 0 ? line.types : (['installation'] as EngagementType[])
                          const lineContacts = (line.contact_ids ?? []).map((id) => contactsMap[id]).filter((c): c is ClientContact => !!c)
                          return (
                            <div key={line.id} className="flex items-stretch gap-0 rounded-lg border border-border/60 bg-muted/20 overflow-hidden">
                              <div className={cn('w-1 shrink-0', TYPE_ACCENT[lineTypes[0]] ?? TYPE_ACCENT.installation)} />
                              <div className="flex-1 min-w-0 p-2.5 space-y-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {lineTypes.map((lt) => {
                                    const TypeIcon = TYPE_ICONS[lt] ?? Wrench
                                    return (
                                      <span key={lt} className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', TYPE_COLORS[lt] ?? TYPE_COLORS.installation)}>
                                        <TypeIcon className="h-3 w-3" /> {TYPE_LABELS[lt] ?? 'Installation'}
                                      </span>
                                    )
                                  })}
                                  <span className="flex items-center gap-1 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400 px-2 py-0.5 text-xs font-medium">
                                    <Package className="h-3 w-3" /> {line.oem}{productsMap[line.product_id] ? ` · ${productsMap[line.product_id].name}` : ''}
                                  </span>
                                  {line.placed_at && (
                                    <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                      <Calendar className="h-3 w-3" /> Placed {formatDate(line.placed_at)}
                                    </span>
                                  )}
                                  {line.expires_at && (() => {
                                    const isPast = new Date(line.expires_at).getTime() < nowMs
                                    return (
                                      <span className={cn(
                                        'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                                        isPast ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-amber-500/10 text-amber-950 dark:text-amber-400'
                                      )}>
                                        {isPast ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                                        {isPast ? 'Expired' : 'Expires'} {formatDate(line.expires_at)}
                                      </span>
                                    )
                                  })()}
                                </div>
                                {lineContacts.length > 0 && (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {lineContacts.map((c) => (
                                      <span key={c.id} className="flex items-center gap-1 rounded-full bg-violet-500/10 pl-0.5 pr-2 py-0.5" title={c.email}>
                                        <UserAvatar name={c.name} size="sm" border={false} shadow={false} />
                                        <span className="text-[11px] font-medium text-violet-700 dark:text-violet-400">
                                          {c.name}{c.designation ? ` · ${c.designation}` : ''}
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Technical Head assignment — the poc/support portion routes to a Team,
                                    the installation portion to engineers (+ spawns a Project); a line can
                                    carry both and each half tracks its own assignment state. */}
                                {(() => {
                                  const needsTeam = lineTypes.some((t) => t === 'poc' || t === 'support') && !line.assigned_team_id
                                  const needsHandlers = lineTypes.includes('installation') && !line.assigned_handler_ids?.length
                                  return (
                                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                      {line.assigned_team_id && (
                                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[11px] font-medium">
                                          <CheckCircle2 className="h-3 w-3" /> {teamsMap[line.assigned_team_id]?.name ?? 'Team'}
                                        </span>
                                      )}
                                      {(line.assigned_handler_ids?.length ?? 0) > 0 && (
                                        <>
                                          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[11px] font-medium">
                                            <CheckCircle2 className="h-3 w-3" />
                                            {usersMap[line.assigned_handler_ids![0]]?.name ?? 'Engineer'}
                                            {line.assigned_handler_ids!.length > 1 ? ` +${line.assigned_handler_ids!.length - 1}` : ''}
                                          </span>
                                          {line.project_id && (
                                            <Link
                                              href={`/projects/${line.project_id}`}
                                              className="flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium hover:bg-primary/20 transition-colors"
                                            >
                                              <FolderKanban className="h-3 w-3" /> View Project
                                            </Link>
                                          )}
                                        </>
                                      )}
                                      {(needsTeam || needsHandlers) && (
                                        isTH ? (
                                          <Button
                                            size="sm" variant="outline" className="h-6 text-[11px] px-2 gap-1"
                                            onClick={() => setAssigningLine({ engagementId: e.id, line })}
                                          >
                                            <UserPlus className="h-3 w-3" /> Assign
                                          </Button>
                                        ) : (
                                          <span className="text-[11px] text-muted-foreground italic">Pending assignment</span>
                                        )
                                      )}
                                    </div>
                                  )
                                })()}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit engagement */}
      {showCreate && (
        <EngagementFormDialog clients={clients ?? []} products={products ?? []} onOpenChange={setShowCreate} />
      )}
      {editing && (
        <EngagementFormDialog
          engagement={editing}
          clients={clients ?? []}
          products={products ?? []}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleting && (
        <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete order?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will permanently delete this order
              {clientsMap[deleting.client_id] ? ` for ${clientsMap[deleting.client_id].company_name}` : ''}. This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleting.id)}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Technical Head assignment */}
      {assigningLine && (
        <AssignLineDialog
          engagementId={assigningLine.engagementId}
          line={assigningLine.line}
          teams={teams ?? []}
          users={users ?? []}
          onOpenChange={(o) => !o && setAssigningLine(null)}
        />
      )}
    </div>
  )
}

function EngagementFormDialog({ engagement, clients, products, onOpenChange }: {
  engagement?: Engagement
  clients: Client[]
  products: Product[]
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = !!engagement
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const [oemOptions] = useState<string[]>(() => loadOemOptions())

  const [clientId, setClientId] = useState(engagement?.client_id ?? '')
  const [customerPo, setCustomerPo] = useState(engagement?.customer_po ?? '')
  const [productLines, setProductLines] = useState<EngagementProductLine[]>(
    engagement?.products.length ? engagement.products.map((l) => ({ ...l })) : [{ id: newId(), types: ['installation'], oem: '', product_id: '', contact_ids: [] }]
  )
  // A brand-new line starts expanded for editing; existing (pre-filled) lines on
  // an edit start collapsed as summary cards.
  const [expandedLineId, setExpandedLineId] = useState<string | null>(isEdit ? null : productLines[0].id)

  const { data: contacts } = useQuery({ queryKey: ['client-contacts'], queryFn: () => dp.listClientContacts() })
  const contactsMap = Object.fromEntries((contacts ?? []).map((c: ClientContact) => [c.id, c]))

  // Customer PO only makes sense once something is actually being purchased —
  // hide it if every product line on this engagement is a POC-only line.
  const showCustomerPo = productLines.some((l) => l.types.some((t) => t !== 'poc'))

  function updateLine(id: string, patch: Partial<EngagementProductLine>) {
    setProductLines((lines) => lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }
  function addLine() {
    const line: EngagementProductLine = { id: newId(), types: ['installation'], oem: '', product_id: '', contact_ids: [] }
    setProductLines((lines) => [...lines, line])
    setExpandedLineId(line.id)
  }
  function removeLine(id: string) {
    setProductLines((lines) => lines.filter((l) => l.id !== id))
    if (expandedLineId === id) setExpandedLineId(null)
  }

  const save = useMutation({
    mutationFn: () => {
      const input = {
        client_id: clientId,
        customer_po: showCustomerPo ? (customerPo.trim() || undefined) : undefined,
        products: productLines.filter((l) => l.oem && l.product_id && l.types.length > 0),
      }
      return isEdit
        ? dp.updateEngagement(engagement.id, input)
        : dp.createEngagement({ ...input, status: 'open', created_by: session.userId })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engagements'] })
      qc.invalidateQueries({ queryKey: ['client-contacts'] })
      toast({ title: isEdit ? 'Order updated' : 'Order created', variant: 'success' })
      onOpenChange(false)
    },
    onError: () => toast({ title: `Could not ${isEdit ? 'update' : 'create'} order`, variant: 'destructive' }),
  })

  const canSave = clientId

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl">{isEdit ? 'Edit order' : 'New order'}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update this installation, POC, or support order' : 'Set up an installation, POC, or support order'}
          </p>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <SearchableSelect
            label="Customer"
            required
            icon={Building2}
            options={clients.map((c) => ({ id: c.id, label: c.company_name }))}
            value={clientId}
            onChange={(v) => { setClientId(v); setProductLines((lines) => lines.map((l) => ({ ...l, contact_ids: [] }))) }}
            placeholder="Select client…"
            searchPlaceholder="Search clients…"
          />

          {showCustomerPo && (
            <div className="space-y-1.5">
              <Label>Customer PO</Label>
              <Input value={customerPo} onChange={(e) => setCustomerPo(e.target.value)} placeholder="PO-2026-0XX" />
            </div>
          )}

          {/* Products */}
          <div className="space-y-2">
            <Label>Products</Label>
            <div className="space-y-2.5">
              {productLines.map((line, i) => {
                const lineProducts = products.filter((p) => p.category === line.oem)
                const lineContacts = line.contact_ids.map((id) => contactsMap[id]).filter((c): c is ClientContact => !!c)

                if (line.id !== expandedLineId) {
                  // Collapsed summary card
                  const productName = products.find((p) => p.id === line.product_id)?.name
                  return (
                    <div key={line.id} className="rounded-xl border bg-muted/20 p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {line.types.map((lt) => {
                            const TypeIcon = TYPE_ICONS[lt] ?? Wrench
                            return (
                              <span key={lt} className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', TYPE_COLORS[lt] ?? TYPE_COLORS.installation)}>
                                <TypeIcon className="h-3 w-3" /> {TYPE_LABELS[lt] ?? 'Installation'}
                              </span>
                            )
                          })}
                          <span className="flex items-center gap-1 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400 px-2 py-0.5 text-xs font-medium">
                            <Package className="h-3 w-3" /> {line.oem || 'No OEM'}{productName ? ` · ${productName}` : ''}
                          </span>
                          {line.placed_at && (
                            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              Placed {formatDate(line.placed_at)}
                            </span>
                          )}
                          {line.expires_at && (
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-950 dark:text-amber-400 px-2 py-0.5 text-[11px] font-medium">
                              Expires {formatDate(line.expires_at)}
                            </span>
                          )}
                        </div>
                        {lineContacts.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {lineContacts.map((c) => (
                              <span key={c.id} className="flex items-center gap-1 rounded-full bg-violet-500/10 pl-0.5 pr-2 py-0.5">
                                <UserAvatar name={c.name} size="sm" border={false} shadow={false} />
                                <span className="text-[11px] font-medium text-violet-700 dark:text-violet-400">
                                  {c.name}{c.designation ? ` · ${c.designation}` : ''}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setExpandedLineId(line.id)}
                          className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Edit product"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {productLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Remove product"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={line.id} className="rounded-xl border bg-muted/20 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Product {i + 1}</span>
                      {productLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Remove product"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>Type <span className="text-destructive">*</span></Label>
                      <TypeMultiSelect value={line.types} onChange={(types) => updateLine(line.id, { types })} />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <SearchableSelect
                        label="OEM"
                        options={oemOptions.map((name) => ({ id: name, label: name }))}
                        value={line.oem}
                        onChange={(v) => updateLine(line.id, { oem: v, product_id: '' })}
                        placeholder="Select OEM…"
                        searchPlaceholder="Search OEMs…"
                      />
                      <SearchableSelect
                        label="Product name"
                        options={lineProducts.map((p) => ({ id: p.id, label: p.name }))}
                        value={line.product_id}
                        onChange={(v) => updateLine(line.id, { product_id: v })}
                        placeholder={line.oem ? 'Select product…' : 'Select OEM first'}
                        searchPlaceholder="Search products…"
                        emptyText={line.oem ? 'No products for this OEM' : 'Select an OEM first'}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1.5">
                        <Label>Placed Date</Label>
                        <Input
                          type="date"
                          value={line.placed_at ?? ''}
                          onChange={(e) => updateLine(line.id, { placed_at: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Expire Date</Label>
                        <Input
                          type="date"
                          value={line.expires_at ?? ''}
                          onChange={(e) => updateLine(line.id, { expires_at: e.target.value })}
                        />
                      </div>
                    </div>

                    <RepresentativePicker
                      clientId={clientId}
                      value={line.contact_ids}
                      onChange={(ids) => updateLine(line.id, { contact_ids: ids })}
                    />
                  </div>
                )
              })}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <PlusCircle className="h-3.5 w-3.5" /> Add product
            </Button>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 sm:justify-stretch">
          <Button
            className="w-full"
            disabled={!canSave || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Multi-select dropdown for a product line's type(s) — a line can be more
// than one at once (e.g. Installation + Support).
function TypeMultiSelect({ value, onChange }: {
  value: EngagementType[]
  onChange: (types: EngagementType[]) => void
}) {
  const [open, setOpen] = useState(false)

  function toggle(t: EngagementType) {
    onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full h-9 rounded-lg border bg-background px-3 flex items-center justify-between gap-2 text-sm transition-colors',
            'hover:border-primary/40',
            open && 'border-primary/50 ring-2 ring-primary/40'
          )}
        >
          <span className={cn('truncate text-left', value.length === 0 && 'text-muted-foreground')}>
            {value.length > 0 ? value.map((t) => TYPE_LABELS[t]).join(', ') : 'Select type(s)…'}
          </span>
          <ChevronsUpDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180 text-primary')} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-1 rounded-xl shadow-lg" align="start">
        {ENGAGEMENT_TYPES.map((t) => {
          const checked = value.includes(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className={cn(
                'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                checked ? 'bg-primary/10' : 'hover:bg-accent/60'
              )}
            >
              <div className={cn(
                'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                checked ? 'bg-primary border-primary' : 'border-muted-foreground/40'
              )}>
                {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
              </div>
              {TYPE_LABELS[t]}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}

// Technical Head assigns one product line — the poc/support portion to a
// Team, the installation portion to one-or-more engineers directly (defaults
// to whoever was selected first, with an explicit "Make Primary" control to
// override) which also spawns a real Project; a line can carry both types at
// once, in which case both sections show and are assigned together. Handler
// picker mirrors app/(app)/projects/page.tsx's ProjectFormDialog.
function AssignLineDialog({ engagementId, line, teams, users, onOpenChange }: {
  engagementId: string
  line: EngagementProductLine
  teams: Team[]
  users: User[]
  onOpenChange: (open: boolean) => void
}) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }
  const needsTeam = line.types.some((t) => t === 'poc' || t === 'support') && !line.assigned_team_id
  const needsHandlers = line.types.includes('installation') && !line.assigned_handler_ids?.length

  const [teamId, setTeamId] = useState('')
  const [handlerIds, setHandlerIds] = useState<string[]>([])

  const eligibleHandlers = users.filter((u) => ['support_engineer', 'team_lead'].includes(u.role) && u.is_active)
  const selectedHandlers = handlerIds.map((id) => users.find((u) => u.id === id)).filter((u): u is User => !!u)
  const availableHandlers = eligibleHandlers.filter((u) => !handlerIds.includes(u.id))

  const assign = useMutation({
    mutationFn: () => dp.assignEngagementProductLine(
      engagementId, line.id,
      {
        ...(needsTeam ? { team_id: teamId } : {}),
        ...(needsHandlers ? { handler_ids: handlerIds } : {}),
      },
      scope
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engagements'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast({
        title: needsTeam && needsHandlers
          ? 'Line assigned — team assigned and project created'
          : needsHandlers ? 'Engineers assigned — project created' : 'Assigned to team',
        variant: 'success',
      })
      onOpenChange(false)
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  const canSave = (!needsTeam || !!teamId) && (!needsHandlers || handlerIds.length > 0)

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {needsHandlers ? <Users className="h-4 w-4" /> : <Handshake className="h-4 w-4" />}
            Assign {line.types.map((t) => TYPE_LABELS[t]).join(' + ')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {needsHandlers && (
            <div className="space-y-1.5">
              <Label>Engineers</Label>
              {selectedHandlers.length > 0 && (
                <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2">
                  {selectedHandlers.map((u, i) => (
                    <div key={u.id} className="flex items-center gap-2">
                      <UserAvatar name={u.name} avatarUrl={u.avatar} userId={u.id} size="sm" border={false} shadow={false} />
                      <p className="flex-1 min-w-0 text-sm font-medium truncate">{u.name}</p>
                      {i === 0 ? (
                        <span className="text-[9px] font-semibold text-primary uppercase tracking-wide shrink-0">Primary</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setHandlerIds((ids) => [u.id, ...ids.filter((id) => id !== u.id)])}
                          className="text-[10px] font-medium text-muted-foreground hover:text-primary shrink-0 transition-colors"
                        >
                          Make Primary
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setHandlerIds((ids) => ids.filter((id) => id !== u.id))}
                        className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {availableHandlers.length > 0 && (
                <Select value="" onValueChange={(uid) => setHandlerIds((ids) => [...ids, uid])}>
                  <SelectTrigger className="h-9 text-sm">
                    <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder={selectedHandlers.length ? 'Add another engineer…' : 'Select engineer(s)…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableHandlers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {needsTeam && (
            <SearchableSelect
              label="Team"
              required
              icon={Users}
              options={teams.filter((t) => t.is_active !== false).map((t) => ({ id: t.id, label: t.name }))}
              value={teamId}
              onChange={setTeamId}
              placeholder="Select team…"
              searchPlaceholder="Search teams…"
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSave || assign.isPending} onClick={() => assign.mutate()}>
            {assign.isPending ? 'Assigning…' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Search-by-email combobox for client representatives — supports selecting
// multiple existing contacts, and creating a new one inline when no match exists.
function RepresentativePicker({ clientId, value, onChange }: {
  clientId: string
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const dp = getDataProvider()
  const qc = useQueryClient()
  const [query, setQuery] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newDesignation, setNewDesignation] = useState('')

  const { data: allContacts } = useQuery({
    queryKey: ['client-contacts', clientId],
    queryFn: () => dp.listClientContacts({ client_id: clientId }),
    enabled: !!clientId,
  })

  const { data: selectedContacts } = useQuery({
    queryKey: ['client-contacts'],
    queryFn: () => dp.listClientContacts(),
  })
  const selected = value.map((id) => (selectedContacts ?? []).find((c) => c.id === id)).filter((c): c is ClientContact => !!c)

  const q = query.trim().toLowerCase()
  const matches = (allContacts ?? []).filter((c) => !value.includes(c.id) && (!q || c.email.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)))

  const createContact = useMutation({
    mutationFn: () => dp.createClientContact({
      client_id: clientId,
      name: newName.trim(),
      email: newEmail.trim(),
      phone: newPhone.trim() || undefined,
      designation: newDesignation.trim() || undefined,
    }),
    onSuccess: (contact) => {
      qc.invalidateQueries({ queryKey: ['client-contacts'] })
      onChange([...value, contact.id])
      setShowNew(false)
      setNewName(''); setNewEmail(''); setNewPhone(''); setNewDesignation(''); setQuery('')
      toast({ title: 'Representative added', variant: 'success' })
    },
    onError: () => toast({ title: 'Could not add representative', variant: 'destructive' }),
  })

  function addContact(id: string) {
    onChange([...value, id])
    setQuery('')
  }
  function removeContact(id: string) {
    onChange(value.filter((x) => x !== id))
  }
  function startCreate() {
    setNewEmail(query.includes('@') ? query : '')
    setNewName(query.includes('@') ? '' : query)
    setShowNew(true)
  }

  return (
    <div className="space-y-1.5">
      <Label>Client representative <span className="text-muted-foreground font-normal">(can select multiple)</span></Label>

      {selected.length > 0 && (
        <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2">
          {selected.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <UserAvatar name={c.name} size="sm" border={false} shadow={false} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {c.name}{c.designation && <span className="text-muted-foreground font-normal"> · {c.designation}</span>}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>
              </div>
              <button
                type="button"
                onClick={() => removeContact(c.id)}
                className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!clientId ? (
        <p className="text-xs text-muted-foreground italic">Select a customer first.</p>
      ) : showNew ? (
        <div className="rounded-xl border bg-muted/20 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">New representative</span>
            <button type="button" onClick={() => setShowNew(false)} className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <X className="h-3 w-3" />
            </button>
          </div>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" />
          <Input value={newDesignation} onChange={(e) => setNewDesignation(e.target.value)} placeholder="Designation" />
          <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email" type="email" />
          <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone number" type="tel" />
          <Button
            type="button" size="sm" className="w-full"
            disabled={!newName.trim() || !newEmail.trim() || createContact.isPending}
            onClick={() => createContact.mutate()}
          >
            <UserPlus className="h-3.5 w-3.5" /> {createContact.isPending ? 'Adding…' : 'Add'}
          </Button>
        </div>
      ) : (
        <div className="relative">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by email…"
            aria-label="Search client representatives by email"
            debounceMs={0}
          />
          {query.trim() && (
            <div className="mt-1.5 rounded-lg border bg-card shadow-sm overflow-hidden">
              {matches.length > 0 ? (
                <div className="max-h-40 overflow-y-auto divide-y">
                  {matches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => addContact(c.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors"
                    >
                      <UserAvatar name={c.name} size="sm" border={false} shadow={false} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {c.name}{c.designation && <span className="text-muted-foreground font-normal"> · {c.designation}</span>}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                onClick={startCreate}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-primary hover:bg-accent transition-colors border-t"
              >
                <UserCircle2 className="h-4 w-4" />
                {matches.length > 0 ? 'Not who you\'re looking for? ' : 'No representative found. '}
                <span className="font-medium">Create new</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
