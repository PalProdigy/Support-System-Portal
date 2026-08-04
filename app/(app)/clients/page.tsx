'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { EmptyState } from '@/components/shared/empty-state'
import { IconField } from '@/components/shared/icon-field'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Building2, PlusCircle, Phone, Eye, User, Mail, Briefcase, Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Client, ClientSolution, Case } from '@/types'
import { formatDate, cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

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
  const [search, setSearch] = useState('')

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
  })

  // Quick client creation — company + a contact person. No login/portal
  // account is created here (that's a separate, deliberate flow elsewhere).
  const canCreate = session.role === 'sales_executive'

  // Technical Head and Team Lead see a dense table view (like the TH Hub
  // "All Cases" board), ordered by most-recent engagement.
  const useTableView = session.role === 'technical_head' || session.role === 'team_lead'

  if (useTableView) {
    return <ClientsTable clients={clients ?? []} isLoading={isLoading} />
  }

  const all = clients ?? []
  const q = search.trim().toLowerCase()
  const filtered = q
    ? all.filter((c) => c.company_name.toLowerCase().includes(q) || c.contact_person.toLowerCase().includes(q))
    : all

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Hero header */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-primary/15 p-3 shrink-0">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clients</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{all.length} client{all.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)}>
            <PlusCircle className="h-4 w-4" /> Create Client
          </Button>
        )}
      </div>

      {all.length > 0 && (
        <SearchInput
          containerClassName="w-full max-w-sm"
          className="h-9"
          placeholder="Search by company or contact…"
          value={search}
          onChange={setSearch}
          aria-label="Search clients"
          resultCount={filtered.length}
          resultLabel="client"
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : all.length === 0 ? (
        <EmptyState icon={Building2} title="No clients" description="No clients in your scope yet." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Building2} title={`No results found for "${search}"`} description="Try a different search term." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c: Client) => {
            const status = c.account_status || 'active'
            const statusConfig = STATUS_COLORS[status] || STATUS_COLORS.active
            return (
              <div
                key={c.id}
                className="group rounded-xl border bg-card p-4 flex flex-col transition-all hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                onClick={() => router.push(`/clients/${c.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <Badge className={cn('text-[11px] font-semibold', statusConfig.badge)}>
                    {statusConfig.label}
                  </Badge>
                </div>

                <p className="font-semibold text-foreground truncate mt-3 group-hover:text-primary transition-colors">{c.company_name}</p>
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {c.contact_person}{c.contact_designation && <span> · {c.contact_designation}</span>}
                </p>

                <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-3 border-t">
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    <Phone className="h-3 w-3" /> {c.phone}
                  </span>
                  {c.industry && (
                    <span className="flex items-center gap-1 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400 px-2 py-0.5 text-[11px] font-medium">
                      {c.industry}
                    </span>
                  )}
                  {c.account_tier && (
                    <span className="flex items-center gap-1 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-400 px-2 py-0.5 text-[11px] font-medium capitalize">
                      {c.account_tier}
                    </span>
                  )}
                </div>

                <p className="flex items-center gap-1 mt-3 text-[11px] text-muted-foreground">
                  <Calendar className="h-3 w-3" /> Since {formatDate(c.created_at)}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && <CreateClientDialog onOpenChange={setShowCreate} />}
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

  // Query cases to count total cases per client
  const { data: casesData } = useQuery({
    queryKey: ['cases', 'all'],
    queryFn: () => dp.listCases({ userId: 'system', role: 'technical_head' }, { pageSize: 500 }),
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

  // Count total cases per client
  const casesByClient = useMemo(() => {
    const map: Record<string, number> = {}
    const cases = (casesData?.items ?? []) as Case[]
    for (const c of cases) {
      if (!map[c.client_id]) {
        map[c.client_id] = 0
      }
      map[c.client_id]++
    }
    return map
  }, [casesData])

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

  const COLS = ['Company / Organization', 'Representative Name', 'Total Case', 'Recent Activity', '']

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
          placeholder="Search Client Name…"
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
                          ? 'sticky right-0 w-24 text-right'
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
                    className="border-b last:border-0 hover:bg-accent/20 transition-colors cursor-pointer group"
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
                    <td className="px-3 py-2.5 whitespace-nowrap font-medium">{casesByClient[c.id] ?? 0}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(recencyOf(c))}</td>
                    <td className="px-3 py-2.5 sticky right-0 bg-card/95 group-hover:bg-accent/20 transition-colors w-24 text-right">
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

// Quick client creation — just the company and a contact person. Deliberately
// does not create a portal login/user account or assign solutions (that's the
// separate, heavier "Create Client Account" flow used elsewhere for prospect
// conversion).
function CreateClientDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()

  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactDesignation, setContactDesignation] = useState('')

  const createMutation = useMutation({
    mutationFn: () => dp.createClient({
      company_name: companyName.trim(),
      contact_person: contactName.trim(),
      contact_designation: contactDesignation.trim() || undefined,
      email: contactEmail.trim() || undefined,
      phone: contactPhone.trim(),
      created_by: session.userId,
    }),
    onSuccess: (client) => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast({ title: `${client.company_name} created`, variant: 'success' })
      onOpenChange(false)
      router.push(`/clients/${client.id}`)
    },
    onError: () => toast({ title: 'Failed to create client', variant: 'destructive' }),
  })

  const canSave = companyName.trim() && contactName.trim() && contactPhone.trim()

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Client</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <IconField
            icon={Building2}
            label="Company Name"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Distributors Ltd"
          />

          <div className="space-y-3 rounded-xl border bg-muted/20 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact Person</p>
            <IconField
              icon={User}
              label="Name"
              required
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Jane Doe"
            />
            <IconField
              icon={Briefcase}
              label="Designation"
              value={contactDesignation}
              onChange={(e) => setContactDesignation(e.target.value)}
              placeholder="Head of IT"
            />
            <div className="grid grid-cols-2 gap-3">
              <IconField
                icon={Mail}
                label="Email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="jane@company.com"
              />
              <IconField
                icon={Phone}
                label="Phone"
                required
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+880 17…"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSave || createMutation.isPending} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? 'Creating…' : 'Create Client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
