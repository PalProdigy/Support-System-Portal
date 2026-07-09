'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Badge } from '@/components/ui/badge'
import { Building2, PlusCircle, Phone, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Client, ClientSolution } from '@/types'
import { formatDate, cn } from '@/lib/utils'
import { CreateClientDialog } from '@/modules/sales-executive/create-client-dialog'

const STATUS_COLORS: Record<string, { badge: string; label: string }> = {
  active: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', label: 'Active' },
  at_risk: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', label: 'At Risk' },
  churned: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', label: 'Churned' },
}

export default function ClientsPage() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const [showCreate, setShowCreate] = useState(false)

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
  })

  // The full "Create Client Account" flow (company info → solutions → review)
  // lives here for the Sales Executive.
  const canCreate = session.role === 'sales_executive'

  // Technical Head and Team Lead see a dense table view (like the TH Hub
  // "All Cases" board), ordered by most-recent engagement.
  const useTableView = session.role === 'technical_head' || session.role === 'team_lead'

  if (useTableView) {
    return <ClientsTable clients={clients ?? []} isLoading={isLoading} />
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">{clients?.length ?? 0} clients</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)}>
            <PlusCircle className="h-4 w-4" /> Create Client Account
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : (clients ?? []).length === 0 ? (
        <EmptyState icon={Building2} title="No clients" description="No clients in your scope yet." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(clients ?? []).map((c: Client) => {
            const status = c.account_status || 'active'
            const statusConfig = STATUS_COLORS[status] || STATUS_COLORS.active
            return (
              <div
                key={c.id}
                className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/clients/${c.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <Badge className={cn('text-xs', statusConfig.badge)}>
                    {statusConfig.label}
                  </Badge>
                </div>
                <p className="font-semibold text-foreground truncate">{c.company_name}</p>
                <p className="text-sm text-muted-foreground truncate">{c.contact_person}</p>
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span>{c.phone}</span>
                </div>
                {c.industry && (
                  <p className="text-xs text-muted-foreground mt-2">{c.industry}</p>
                )}
                {c.account_tier && (
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Tier:</span>
                    <span className="font-medium capitalize">{c.account_tier}</span>
                  </div>
                )}
                <p className="mt-3 text-[10px] text-muted-foreground">Since {formatDate(c.created_at)}</p>
              </div>
            )
          })}
        </div>
      )}

      <CreateClientDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  )
}

/**
 * Table view for Technical Head / Team Lead.
 *  - Ordered by the most recent engagement (product / service / solution taken),
 *    so the currently-active clients appear at the top and older ones below.
 *  - Search by Client Name (contact person), Client ID, or Company / Organization
 *    name — filters live as you type (debounced), or immediately on Enter.
 *  - Total client count shown at the top; a row click opens the client detail.
 */
function ClientsTable({ clients, isLoading }: { clients: Client[]; isLoading: boolean }) {
  const dp = getDataProvider()
  const router = useRouter()

  const [query, setQuery] = useState('')

  // Client-solution links carry the date a client engaged a solution; we use the
  // most recent of these (falling back to last_activity_at / created_at) as the
  // recency key for ordering.
  const { data: clientSolutions } = useQuery({
    queryKey: ['client-solutions'],
    queryFn: () => dp.listClientSolutions(),
  })

  const recentByClient = useMemo(() => {
    const map: Record<string, string> = {}
    for (const cs of (clientSolutions ?? []) as ClientSolution[]) {
      if (!map[cs.client_id] || cs.created_at > map[cs.client_id]) {
        map[cs.client_id] = cs.created_at
      }
    }
    return map
  }, [clientSolutions])

  const recencyOf = (c: Client) => {
    const dates = [recentByClient[c.id], c.last_activity_at, c.created_at].filter(Boolean) as string[]
    return dates.sort().at(-1) ?? c.created_at
  }

  const ordered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? clients.filter((c) =>
          c.contact_person?.toLowerCase().includes(q) ||
          c.company_name?.toLowerCase().includes(q)
        )
      : clients
    // Most recent engagement first (current → previous).
    return [...filtered].sort((a, b) => recencyOf(b).localeCompare(recencyOf(a)))
  }, [clients, query, recentByClient])

  const COLS = ['Company / Organization', 'Representative Name', 'Recent Activity', '']

  return (
    <div className="p-6 space-y-4">
      {/* Header + total count */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Clients</h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{clients.length}</span> total
              {query && <> · {ordered.length} match “{query}”</>}
            </p>
          </div>
        </div>

        {/* Search — searches Client Name or Company / Organization */}
        <SearchInput
          containerClassName="w-full max-w-xs"
          placeholder="Search by Client Name or Company / Organization…"
          value={query}
          onChange={setQuery}
          aria-label="Search clients"
          resultCount={ordered.length}
          resultLabel="client"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState icon={Building2} title="No clients" description="No clients in your scope yet." />
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {COLS.map((h, i) => {
                  const isActionCol = i === COLS.length - 1
                  return (
                    <th
                      key={i}
                      className={`text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground ${
                        isActionCol
                          ? 'sticky right-0 bg-muted/30 w-24 text-right'
                          : 'whitespace-nowrap'
                      }`}
                    >
                      {h}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {ordered.length === 0 && (
                <tr><td colSpan={COLS.length} className="text-center py-8 text-muted-foreground text-sm">{query ? `No results found for "${query}"` : 'No clients match your search'}</td></tr>
              )}
              {ordered.map((c) => {
                return (
                  <tr
                    key={c.id}
                    className="border-b last:border-0 hover:bg-accent/20 transition-colors cursor-pointer"
                    onClick={() => router.push(`/clients/${c.id}`)}
                  >
                    <td className="px-3 py-2.5 max-w-[240px]">
                      <div className="flex items-center gap-2">
                        <div className="rounded-md bg-primary/10 p-1.5 shrink-0">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="truncate font-medium">{c.company_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{c.contact_person}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(recencyOf(c))}</td>
                    <td className="px-3 py-2.5 sticky right-0 bg-card/95 w-24 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/clients/${c.id}`)}
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
