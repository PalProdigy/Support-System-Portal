'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { EmptyState } from '@/components/shared/empty-state'
import { StatCard } from '@/components/shared/stat-card'
import { UserAvatar } from '@/components/shared/user-avatar'
import { SearchInput } from '@/components/ui/search-input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { getCategoryMeta } from '@/lib/products-shared'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import {
  ShieldX, BadgeAlert, AlertTriangle, CheckCircle2, Building2, User, Mail, Phone,
  Calendar, Package, Contact, CalendarDays,
} from 'lucide-react'
import type { ProductLicense, Client, ClientContact, Product } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  at_risk: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  churned: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
}

const DAY_MS = 86_400_000
const EXPIRY_SOON_DAYS = 90

function expiryLabel(days: number): string {
  if (days < 0) return `Expired ${-days}d ago`
  if (days === 0) return 'Expires today'
  return `${days}d left`
}

export default function LicenseSlaPage() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }
  const [nowMs] = useState(() => Date.now())
  const [tab, setTab] = useState<'expiring' | 'expired' | 'healthy'>('expiring')
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<{ client: Client; kind: 'License' | 'SLA'; product_id: string; purchased_at: string; expires_at: string; days: number } | null>(null)

  const { data: clients, isLoading: clientsLoading } = useQuery({ queryKey: ['clients', session.userId], queryFn: () => dp.listClients(scope) })
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => dp.listProducts() })
  const { data: licenses, isLoading: licensesLoading } = useQuery({ queryKey: ['product-licenses'], queryFn: () => dp.listProductLicenses() })

  const clientById = useMemo(() => Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c])), [clients])
  const clientsMap = useMemo(() => Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c.company_name])), [clients])
  const productsMap = useMemo(() => Object.fromEntries((products ?? []).map((p: Product) => [p.id, p.name])), [products])
  const productById = useMemo(() => Object.fromEntries((products ?? []).map((p: Product) => [p.id, p])), [products])

  const { data: viewingContacts } = useQuery({
    queryKey: ['client-contacts', viewing?.client.id],
    queryFn: () => dp.listClientContacts({ client_id: viewing!.client.id }),
    enabled: !!viewing,
  })

  // Scope to this account manager's own clients (matches My Clients / Clients page scoping).
  const myClientIds = useMemo(() => new Set((clients ?? []).map((c: Client) => c.id)), [clients])

  const rows = useMemo(() => {
    return (licenses ?? [])
      .filter((l: ProductLicense) => myClientIds.has(l.client_id))
      .flatMap((l: ProductLicense) => [
        { id: `${l.id}-license`, kind: 'License' as const, expires_at: l.license_expires_at, purchased_at: l.created_at, client_id: l.client_id, product_id: l.product_id },
        { id: `${l.id}-sla`, kind: 'SLA' as const, expires_at: l.sla_expires_at, purchased_at: l.created_at, client_id: l.client_id, product_id: l.product_id },
      ])
      .map((r) => ({ ...r, days: Math.floor((new Date(r.expires_at).getTime() - nowMs) / DAY_MS) }))
      .sort((a, b) => a.days - b.days)
  }, [licenses, myClientIds, nowMs])

  const expired = useMemo(() => rows.filter((r) => r.days < 0), [rows])
  const expiringSoon = useMemo(() => rows.filter((r) => r.days >= 0 && r.days <= EXPIRY_SOON_DAYS), [rows])
  const healthy = useMemo(() => rows.filter((r) => r.days > EXPIRY_SOON_DAYS), [rows])

  const shown = tab === 'expiring' ? expiringSoon : tab === 'expired' ? expired : healthy
  const q = search.trim().toLowerCase()
  const filtered = q
    ? shown.filter((r) => (productsMap[r.product_id] ?? '').toLowerCase().includes(q) || (clientsMap[r.client_id] ?? '').toLowerCase().includes(q))
    : shown

  const isLoading = clientsLoading || licensesLoading

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Hero header */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 flex items-center gap-4">
        <div className="rounded-xl bg-primary/15 p-3 shrink-0">
          <ShieldX className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">License &amp; SLA Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track license and support-contract expiry across your clients</p>
        </div>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard
          title="Expiring Soon"
          value={expiringSoon.length}
          subtitle={`within ${EXPIRY_SOON_DAYS} days`}
          icon={BadgeAlert}
          iconColor="text-amber-500"
          loading={isLoading}
        />
        <StatCard title="Expired" value={expired.length} icon={AlertTriangle} iconColor="text-red-500" loading={isLoading} />
        <StatCard title="Healthy" value={healthy.length} icon={CheckCircle2} iconColor="text-emerald-500" loading={isLoading} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 shrink-0">
          {([
            { key: 'expiring', label: 'Expiring Soon', count: expiringSoon.length },
            { key: 'expired', label: 'Expired', count: expired.length },
            { key: 'healthy', label: 'Healthy', count: healthy.length },
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors',
                tab === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label} <span className="tabular-nums opacity-70">({count})</span>
            </button>
          ))}
        </div>
        <SearchInput
          containerClassName="flex-1 min-w-48"
          className="h-9"
          placeholder="Search by client or product…"
          value={search}
          onChange={setSearch}
          aria-label="Search license and SLA rows"
          resultCount={filtered.length}
          resultLabel="item"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShieldX}
          title={search ? `No results found for "${search}"` : `Nothing ${tab === 'expiring' ? 'expiring soon' : tab}`}
          description={search ? 'Try a different search term.' : undefined}
        />
      ) : (
        <div className="rounded-xl border bg-card divide-y">
          {filtered.map((r) => (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors"
              onClick={() => {
                const client = clientById[r.client_id]
                if (client) setViewing({ client, kind: r.kind, product_id: r.product_id, purchased_at: r.purchased_at, expires_at: r.expires_at, days: r.days })
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                const client = clientById[r.client_id]
                if (client) setViewing({ client, kind: r.kind, product_id: r.product_id, purchased_at: r.purchased_at, expires_at: r.expires_at, days: r.days })
              }}
            >
              <span className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 w-14 text-center',
                r.kind === 'License'
                  ? 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40'
                  : 'text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/40'
              )}>
                {r.kind}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{productsMap[r.product_id] ?? r.product_id}</p>
                <p className="text-xs text-muted-foreground truncate">{clientsMap[r.client_id] ?? r.client_id}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={cn(
                  'text-xs font-semibold',
                  r.days < 0 ? 'text-red-600 dark:text-red-400' : r.days <= EXPIRY_SOON_DAYS ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                )}>
                  {expiryLabel(r.days)}
                </p>
                <p className="text-[11px] text-muted-foreground">{formatDateTime(r.expires_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Client detail modal */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden max-h-[85vh] overflow-y-auto">
          {viewing && (() => {
            const product = productById[viewing.product_id]
            const meta = product ? getCategoryMeta(product.category) : null
            const reps = viewingContacts ?? []
            return (
              <>
                <DialogHeader className="sr-only">
                  <DialogTitle>{viewing.client.company_name}</DialogTitle>
                </DialogHeader>

                {/* Hero */}
                <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 flex items-start gap-4">
                  <div className="rounded-xl bg-primary/15 p-3 shrink-0">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-foreground truncate">{viewing.client.company_name}</h2>
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <Badge className={cn('text-[11px]', STATUS_COLORS[viewing.client.account_status || 'active'])}>
                        {(viewing.client.account_status || 'active').replace('_', ' ')}
                      </Badge>
                      {viewing.client.account_tier && (
                        <Badge variant="secondary" className="text-[11px] capitalize">{viewing.client.account_tier}</Badge>
                      )}
                      {viewing.client.industry && (
                        <Badge variant="outline" className="text-[11px]">{viewing.client.industry}</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* License / SLA status strip */}
                  <div className="rounded-xl border bg-muted/20 p-3 space-y-2.5">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'text-[10px] font-semibold px-2 py-1 rounded-full shrink-0',
                        viewing.kind === 'License'
                          ? 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40'
                          : 'text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/40'
                      )}>
                        {viewing.kind === 'License' ? 'License' : 'SLA'}
                      </span>
                      <p className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{product?.name ?? productsMap[viewing.product_id]}</p>
                      <span className={cn(
                        'text-xs font-semibold shrink-0',
                        viewing.days < 0 ? 'text-red-600 dark:text-red-400' : viewing.days <= EXPIRY_SOON_DAYS ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                      )}>
                        {expiryLabel(viewing.days)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Purchased</p>
                        <p className="flex items-center gap-1 text-xs text-foreground mt-0.5">
                          <CalendarDays className="h-3 w-3 text-muted-foreground" /> {formatDate(viewing.purchased_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Expires</p>
                        <p className="flex items-center gap-1 text-xs text-foreground mt-0.5">
                          <CalendarDays className="h-3 w-3 text-muted-foreground" /> {formatDateTime(viewing.expires_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Client contact person */}
                  <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <User className="h-3.5 w-3.5" /> Contact Person
                    </p>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={viewing.client.contact_person} size="md" border shadow />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{viewing.client.contact_person}</p>
                        {viewing.client.contact_designation && (
                          <p className="text-xs text-muted-foreground truncate">{viewing.client.contact_designation}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
                      {viewing.client.phone && (
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {viewing.client.phone}</span>
                      )}
                      {viewing.client.email && (
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {viewing.client.email}</span>
                      )}
                    </div>
                  </div>

                  {/* Client representatives for this product */}
                  <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2.5">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Contact className="h-3.5 w-3.5" /> Client Representatives
                    </p>
                    {reps.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No representatives on file for this client.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {reps.map((c: ClientContact, i: number) => (
                          <div key={c.id}>
                            {i > 0 && <div className="border-t mb-2.5" />}
                            <div className="flex items-center gap-3">
                              <UserAvatar name={c.name} size="md" border shadow />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                                {c.designation && <p className="text-xs text-muted-foreground truncate">{c.designation}</p>}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
                              {c.phone && (
                                <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</span>
                              )}
                              {c.email && (
                                <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Product + OEM Product Manager */}
                  {product && (
                    <div className="rounded-xl border overflow-hidden">
                      {meta && <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.shade})` }} />}
                      <div className="p-3.5 space-y-3">
                        <div className="flex items-center gap-2.5">
                          {meta ? (
                            <div
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold shrink-0"
                              style={{ background: meta.tint, color: meta.color }}
                            >
                              {meta.mono}
                            </div>
                          ) : (
                            <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                              <Package className="h-4 w-4 text-primary" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{product.category}</p>
                          </div>
                        </div>

                        {product.manager?.name ? (
                          <div className="rounded-lg bg-muted/40 p-3 space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Product Manager</p>
                            <div className="flex items-center gap-3">
                              <UserAvatar name={product.manager.name} size="sm" border shadow />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">{product.manager.name}</p>
                                {(product.manager.designation || product.manager.employee_id) && (
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {product.manager.designation}
                                    {product.manager.designation && product.manager.employee_id ? ' · ' : ''}
                                    {product.manager.employee_id}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                              {product.manager.email && (
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                                  <Mail className="h-3 w-3 shrink-0" /> {product.manager.email}
                                </span>
                              )}
                              {product.manager.phone && (
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                                  <Phone className="h-3 w-3 shrink-0" /> {product.manager.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No product manager on file.</p>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" /> Client since {formatDate(viewing.client.created_at)}
                  </p>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
