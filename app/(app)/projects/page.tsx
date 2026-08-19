'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { UserAvatar } from '@/components/shared/user-avatar'
import { EmptyState } from '@/components/shared/empty-state'
import { StatCard } from '@/components/shared/stat-card'
import { SearchableSelect } from '@/components/shared/searchable-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SearchInput } from '@/components/ui/search-input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { cn, formatDate } from '@/lib/utils'
import { getCategoryMeta } from '@/lib/products-shared'
import {
  FolderKanban, Building2, Calendar, Pencil, Trash2, X,
  UserPlus, CheckCircle2, ListTodo, Package, Crown, Wrench, FlaskConical, LifeBuoy,
  Users, PlayCircle, XCircle, Clock,
} from 'lucide-react'
import type { Project, ProjectStatus, Client, User, Priority, Product, Team } from '@/types'

const PROJECT_STATUSES: ProjectStatus[] = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled']

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical']

// Left accent bar per priority — carries the signal that used to live in the
// (now removed) status/priority text badges, without adding more text to the card.
const PRIORITY_ACCENT: Record<Priority, string> = {
  low: 'bg-slate-300',
  medium: 'bg-sky-400',
  high: 'bg-orange-400',
  critical: 'bg-red-500',
}

export default function ProjectsPage() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }
  const canManage = ['technical_head', 'team_lead'].includes(session.role)

  const [tab, setTab] = useState<'installations' | 'poc' | 'services'>('installations')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => dp.listProjects(scope),
  })

  const { data: clients } = useQuery({ queryKey: ['clients', session.userId], queryFn: () => dp.listClients(scope) })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => dp.listProducts() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
  const { data: engagements, isLoading: pocLoading } = useQuery({
    queryKey: ['engagements', session.userId, session.role],
    queryFn: () => dp.listEngagements(scope),
  })

  const clientsMap = Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c]))
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))
  const productsMap = Object.fromEntries((products ?? []).map((p: Product) => [p.id, p]))
  const teamsMap = Object.fromEntries((teams ?? []).map((t: Team) => [t.id, t]))

  const outcomeMutation = useMutation({
    mutationFn: ({ engagementId, lineId, outcome }: { engagementId: string; lineId: string; outcome: 'running' | 'success' | 'failed' }) =>
      dp.setEngagementLinePocOutcome(engagementId, lineId, outcome, scope),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engagements', session.userId, session.role] })
      toast({ title: 'POC status updated', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to update POC status', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dp.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast({ title: 'Project deleted', variant: 'success' })
      setDeleting(null)
    },
    onError: () => toast({ title: 'Failed to delete project', variant: 'destructive' }),
  })

  const all = projects ?? []
  const q = search.trim().toLowerCase()
  const filtered = all
    .filter((p) => statusFilter === 'all' || p.status === statusFilter)
    .filter((p) => !q || p.title.toLowerCase().includes(q) || (clientsMap[p.client_id]?.company_name ?? '').toLowerCase().includes(q))

  const totalCount = all.length
  const activeCount = all.filter((p) => p.status === 'in_progress' || p.status === 'planning').length
  const completedCount = all.filter((p) => p.status === 'completed').length

  const pocEntries = (engagements ?? []).flatMap((e) =>
    e.products.filter((p) => p.types.includes('poc')).map((line) => ({ engagementId: e.id, clientId: e.client_id, line }))
  )
  const pocTotal = pocEntries.length
  const pocRunning = pocEntries.filter(({ line }) => !!line.assigned_team_id && (!line.poc_outcome || line.poc_outcome === 'running')).length
  const pocSuccess = pocEntries.filter(({ line }) => line.poc_outcome === 'success').length
  const pocFailed = pocEntries.filter(({ line }) => line.poc_outcome === 'failed').length

  const serviceEntries = (engagements ?? []).flatMap((e) =>
    e.products.filter((p) => p.types.includes('support')).map((line) => ({ engagementId: e.id, clientId: e.client_id, line }))
  )
  const serviceTotal = serviceEntries.length
  const serviceExpired = serviceEntries.filter(({ line }) => !!line.expires_at && new Date(line.expires_at) < new Date()).length
  const serviceActive = serviceTotal - serviceExpired

  return (
    <div className="px-6 pb-6 pt-3 max-w-6xl mx-auto space-y-4 ">
      {/* Hero header */}
      <div className="  flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-primary/15 p-3 shrink-0">
            <FolderKanban className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projects</h1>

          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'installations' | 'poc' | 'services')}>
        <TabsList className="grid h-auto w-full max-w-full grid-flow-col auto-cols-fr gap-1 overflow-hidden">
          <TabsTrigger value="installations" className="w-full min-w-0 gap-1.5 truncate">
            <Wrench className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Installations</span>
          </TabsTrigger>
          <TabsTrigger value="poc" className="w-full min-w-0 gap-1.5 truncate">
            <FlaskConical className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">POC</span>
          </TabsTrigger>
          <TabsTrigger value="services" className="w-full min-w-0 gap-1.5 truncate">
            <LifeBuoy className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Service</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="installations" className="space-y-6 mt-4">
      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard title="Total Projects" value={totalCount} icon={FolderKanban} loading={isLoading} />
        <StatCard title="Active" value={activeCount} icon={ListTodo} iconColor="text-blue-500" loading={isLoading} />
        <StatCard title="Completed" value={completedCount} icon={CheckCircle2} iconColor="text-emerald-500" loading={isLoading} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <SearchInput
          containerClassName="flex-1 min-w-48"
          className="h-9"
          placeholder="Search by title or client…"
          value={search}
          onChange={setSearch}
          debounceMs={250}
          aria-label="Search projects"
          resultCount={filtered.length}
          resultLabel="project"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {PROJECT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={search ? `No results found for "${search}"` : 'No projects found'}
          description={statusFilter !== 'all' || search ? 'Try adjusting your filters.' : 'No projects yet.'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const client = clientsMap[p.client_id]
            const product = p.product_id ? productsMap[p.product_id] : undefined
            const meta = product ? getCategoryMeta(product.category) : null
            const handlers = p.handler_ids.map((id) => usersMap[id]).filter((u): u is User => !!u)
            const [primary, ...support] = handlers
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/projects/${p.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/projects/${p.id}`) }}
                className="group flex items-stretch gap-0 rounded-xl border bg-card overflow-hidden transition-all hover:border-primary/40 hover:shadow-lg cursor-pointer"
              >
                <div className={cn('w-1.5 shrink-0', PRIORITY_ACCENT[p.priority ?? 'medium'])} />

                <div className="flex-1 min-w-0 flex items-start gap-3.5 p-4">
                  {meta ? (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold tracking-wide shrink-0"
                      style={{ background: meta.tint, color: meta.color }}
                    >
                      {meta.mono}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
                      <FolderKanban className="h-5 w-5 text-primary" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">{p.title}</p>
                      {canManage && (
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditing(p); setShowForm(true) }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleting(p) }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}

                    <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t text-xs">
                      {client && (
                        <span className="flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                          <Building2 className="h-3 w-3" /> {client.company_name}
                        </span>
                      )}
                      {product && meta && (
                        <span
                          className="flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
                          style={{ background: meta.tint, color: meta.color }}
                        >
                          <Package className="h-3 w-3" /> {product.category} · {product.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-950 dark:text-amber-400 px-2 py-0.5 font-medium">
                        <Calendar className="h-3 w-3" /> {formatDate(p.created_at)}
                      </span>
                    </div>

                    {handlers.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {primary && (
                          <span className="flex items-center gap-1 rounded-full bg-primary/10 pl-0.5 pr-2 py-0.5">
                            <UserAvatar name={primary.name} avatarUrl={primary.avatar} userId={primary.id} size="sm" border={false} shadow={false} />
                            <span className="text-[11px] font-medium text-foreground">{primary.name}</span>
                            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-primary uppercase tracking-wide">
                              <Crown className="h-2.5 w-2.5" /> Primary
                            </span>
                          </span>
                        )}
                        {support.map((u) => (
                          <span key={u.id} className="flex items-center gap-1 rounded-full bg-violet-500/10 pl-0.5 pr-2 py-0.5">
                            <UserAvatar name={u.name} avatarUrl={u.avatar} userId={u.id} size="sm" border={false} shadow={false} />
                            <span className="text-[11px] font-medium text-violet-700 dark:text-violet-400">{u.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
        </TabsContent>

        <TabsContent value="poc" className="space-y-6 mt-4">
          {/* Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard title="Total POC" value={pocTotal} icon={FlaskConical} iconColor="text-violet-500" loading={pocLoading} />
            <StatCard title="Running" value={pocRunning} icon={PlayCircle} iconColor="text-blue-500" loading={pocLoading} />
            <StatCard title="Success" value={pocSuccess} icon={CheckCircle2} iconColor="text-emerald-500" loading={pocLoading} />
            <StatCard title="Failed" value={pocFailed} icon={XCircle} iconColor="text-red-500" loading={pocLoading} />
          </div>

          {/* List */}
          {pocLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
          ) : pocEntries.length === 0 ? (
            <EmptyState icon={FlaskConical} title="No POCs found" description="No POC lines have been raised yet." />
          ) : (
            <div className="space-y-3">
              {pocEntries.map(({ engagementId, clientId, line }) => {
                const client = clientsMap[clientId]
                const product = productsMap[line.product_id]
                const meta = product ? getCategoryMeta(product.category) : null
                const team = line.assigned_team_id ? teamsMap[line.assigned_team_id] : undefined
                const outcome = line.poc_outcome ?? (line.assigned_team_id ? 'running' : undefined)
                return (
                  <div
                    key={line.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push('/engagements')}
                    onKeyDown={(e) => { if (e.key === 'Enter') router.push('/engagements') }}
                    className="group flex items-stretch gap-0 rounded-xl border bg-card overflow-hidden transition-all hover:border-primary/40 hover:shadow-lg cursor-pointer"
                  >
                    <div className={cn('w-1.5 shrink-0', outcome === 'success' ? 'bg-emerald-500' : outcome === 'failed' ? 'bg-red-500' : outcome === 'running' ? 'bg-blue-400' : 'bg-slate-300')} />

                    <div className="flex-1 min-w-0 flex items-start gap-3.5 p-4">
                      {meta ? (
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold tracking-wide shrink-0"
                          style={{ background: meta.tint, color: meta.color }}
                        >
                          {meta.mono}
                        </div>
                      ) : (
                        <div className="rounded-xl bg-violet-500/10 p-2.5 shrink-0">
                          <FlaskConical className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {product ? `${product.category} · ${product.name}` : line.oem}
                          </p>
                          {outcome ? (
                            <span className={cn(
                              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0',
                              outcome === 'success' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                              outcome === 'failed' && 'bg-red-500/10 text-red-600 dark:text-red-400',
                              outcome === 'running' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                            )}>
                              {outcome === 'success' && <CheckCircle2 className="h-3 w-3" />}
                              {outcome === 'failed' && <XCircle className="h-3 w-3" />}
                              {outcome === 'running' && <PlayCircle className="h-3 w-3" />}
                              {outcome[0].toUpperCase() + outcome.slice(1)}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground shrink-0">
                              <Clock className="h-3 w-3" /> Unassigned
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t text-xs">
                          {client && (
                            <span className="flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                              <Building2 className="h-3 w-3" /> {client.company_name}
                            </span>
                          )}
                          {team && (
                            <span className="flex items-center gap-1 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-400 px-2 py-0.5 font-medium">
                              <Users className="h-3 w-3" /> {team.name}
                            </span>
                          )}
                          {line.placed_at && (
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-950 dark:text-amber-400 px-2 py-0.5 font-medium">
                              <Calendar className="h-3 w-3" /> {formatDate(line.placed_at)}
                            </span>
                          )}
                        </div>

                        {canManage && line.assigned_team_id && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-2.5" onClick={(e) => e.stopPropagation()}>
                            {(['running', 'success', 'failed'] as const).map((o) => (
                              <Button
                                key={o}
                                size="sm"
                                variant={outcome === o ? 'default' : 'outline'}
                                className="h-6 px-2 text-[11px] gap-1"
                                disabled={outcomeMutation.isPending}
                                onClick={() => outcomeMutation.mutate({ engagementId, lineId: line.id, outcome: o })}
                              >
                                {o === 'running' && <PlayCircle className="h-3 w-3" />}
                                {o === 'success' && <CheckCircle2 className="h-3 w-3" />}
                                {o === 'failed' && <XCircle className="h-3 w-3" />}
                                {o[0].toUpperCase() + o.slice(1)}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="services" className="space-y-6 mt-4">
          {/* Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard title="Total Services" value={serviceTotal} icon={LifeBuoy} iconColor="text-violet-500" loading={pocLoading} />
            <StatCard title="Active" value={serviceActive} icon={CheckCircle2} iconColor="text-emerald-500" loading={pocLoading} />
            <StatCard title="Expired" value={serviceExpired} icon={XCircle} iconColor="text-red-500" loading={pocLoading} />
          </div>

          {/* List */}
          {pocLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
          ) : serviceEntries.length === 0 ? (
            <EmptyState icon={LifeBuoy} title="No services found" description="No support/service lines have been raised yet." />
          ) : (
            <div className="space-y-3">
              {serviceEntries.map(({ clientId, line }) => {
                const client = clientsMap[clientId]
                const product = productsMap[line.product_id]
                const meta = product ? getCategoryMeta(product.category) : null
                const isExpired = !!line.expires_at && new Date(line.expires_at) < new Date()
                return (
                  <div
                    key={line.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push('/engagements')}
                    onKeyDown={(e) => { if (e.key === 'Enter') router.push('/engagements') }}
                    className="group flex items-stretch gap-0 rounded-xl border bg-card overflow-hidden transition-all hover:border-primary/40 hover:shadow-lg cursor-pointer"
                  >
                    <div className={cn('w-1.5 shrink-0', isExpired ? 'bg-red-500' : 'bg-emerald-500')} />

                    <div className="flex-1 min-w-0 flex items-start gap-3.5 p-4">
                      {meta ? (
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold tracking-wide shrink-0"
                          style={{ background: meta.tint, color: meta.color }}
                        >
                          {meta.mono}
                        </div>
                      ) : (
                        <div className="rounded-xl bg-violet-500/10 p-2.5 shrink-0">
                          <LifeBuoy className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {product ? `${product.category} · ${product.name}` : line.oem}
                          </p>
                          {line.expires_at ? (
                            <span className={cn(
                              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0',
                              isExpired ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            )}>
                              <Clock className="h-3 w-3" /> {isExpired ? 'Expired' : 'Expires'} {formatDate(line.expires_at)}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground shrink-0">
                              <Clock className="h-3 w-3" /> No expiry set
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t text-xs">
                          {client && (
                            <span className="flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                              <Building2 className="h-3 w-3" /> {client.company_name}
                            </span>
                          )}
                          {line.placed_at && (
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-950 dark:text-amber-400 px-2 py-0.5 font-medium">
                              <Calendar className="h-3 w-3" /> {formatDate(line.placed_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit */}
      {showForm && editing && (
        <ProjectFormDialog
          project={editing}
          clients={clients ?? []}
          users={users ?? []}
          products={products ?? []}
          onOpenChange={setShowForm}
        />
      )}

      {/* Delete confirmation */}
      {deleting && (
        <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete project?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will permanently delete <span className="font-medium text-foreground">{deleting.title}</span>. This action cannot be undone.
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
    </div>
  )
}

function ProjectFormDialog({ project, clients, users, products, onOpenChange }: {
  project: Project
  clients: Client[]
  users: User[]
  products: Product[]
  onOpenChange: (open: boolean) => void
}) {
  const dp = getDataProvider()
  const qc = useQueryClient()

  const [title, setTitle] = useState(project.title)
  const [description, setDescription] = useState(project.description ?? '')
  const [clientId, setClientId] = useState(project.client_id)
  const [productId, setProductId] = useState(project.product_id ?? '')
  const [status, setStatus] = useState<ProjectStatus>(project.status)
  const [priority, setPriority] = useState<Priority>(project.priority ?? 'medium')
  const [handlerIds, setHandlerIds] = useState<string[]>(project.handler_ids ?? [])

  const eligibleHandlers = users.filter((u) => ['support_engineer', 'team_lead'].includes(u.role) && u.is_active)
  const selectedHandlers = handlerIds.map((id) => users.find((u) => u.id === id)).filter((u): u is User => !!u)
  const availableHandlers = eligibleHandlers.filter((u) => !handlerIds.includes(u.id))

  const save = useMutation({
    mutationFn: () => dp.updateProject(project.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      client_id: clientId,
      product_id: productId || undefined,
      handler_ids: handlerIds,
      status,
      priority,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast({ title: 'Project updated', variant: 'success' })
      onOpenChange(false)
    },
    onError: () => toast({ title: 'Could not update project', variant: 'destructive' }),
  })

  const canSave = title.trim() && clientId

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this project about?" />
          </div>

          <SearchableSelect
            label="Client"
            required
            icon={Building2}
            options={clients.map((c) => ({ id: c.id, label: c.company_name }))}
            value={clientId}
            onChange={setClientId}
            placeholder="Select client…"
            searchPlaceholder="Search clients…"
          />

          <SearchableSelect
            label="Product / OEM"
            icon={Package}
            options={products.map((p) => ({ id: p.id, label: p.name, sublabel: p.category }))}
            value={productId}
            onChange={setProductId}
            placeholder="Select product…"
            searchPlaceholder="Search products…"
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Handled By <span className="text-muted-foreground font-normal">(optional, multiple allowed)</span></Label>
            {selectedHandlers.length > 0 && (
              <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2">
                {selectedHandlers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2">
                    <UserAvatar name={u.name} avatarUrl={u.avatar} userId={u.id} size="sm" border={false} shadow={false} />
                    <p className="flex-1 min-w-0 text-sm font-medium truncate">{u.name}</p>
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
                  <SelectValue placeholder={selectedHandlers.length ? 'Add another person…' : 'Select handler(s)…'} />
                </SelectTrigger>
                <SelectContent>
                  {availableHandlers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
