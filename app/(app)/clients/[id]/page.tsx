'use client'

import { use, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { CaseCard } from '@/components/shared/case-card'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { StatCard } from '@/components/shared/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchInput } from '@/components/ui/search-input'
import { UserAvatar } from '@/components/shared/user-avatar'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  ArrowLeft, Building2, Phone, Mail, Ticket, CheckCircle2, AlertTriangle, Clock,
  Package, User as UserIcon, Calendar, Activity, Wrench, FlaskConical, LifeBuoy,
  FolderKanban, Star, MessageCircle,
} from 'lucide-react'
import type { Case, EngagementType, Project, ProjectStatus, Feedback } from '@/types'
import { formatDate, cn } from '@/lib/utils'
import { getCategoryMeta } from '@/lib/products-shared'

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
const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  planning: 'bg-slate-500/10 text-slate-700 dark:text-slate-400',
  in_progress: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  on_hold: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  cancelled: 'bg-red-500/10 text-red-700 dark:text-red-400',
}

function StarRow({ rating }: { rating?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn('h-3.5 w-3.5', rating != null && i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25')} />
      ))}
    </div>
  )
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const scope = { userId: session.userId, role: session.role }
  const view = searchParams.get('view') || 'cases'
  const tab = searchParams.get('tab') || 'active'
  const [caseSearch, setCaseSearch] = useState('')

  const { data: client, isLoading: loadingClient, error, refetch } = useQuery({
    queryKey: ['client', id],
    queryFn: () => dp.getClient(id),
  })

  // Older clients created via the full "account + login" flow store their
  // contact's email on the linked portal user, not on the Client record itself.
  const { data: linkedUser } = useQuery({
    queryKey: ['user', client?.user_id],
    queryFn: () => dp.getUser(client!.user_id!),
    enabled: !!client?.user_id && !client?.email,
  })

  const { data: casesPage, isLoading: loadingCases } = useQuery({
    queryKey: ['cases', session.userId, { client_id: id }],
    queryFn: () => dp.listCases(scope, { client_id: id, pageSize: 50 }),
    enabled: !!client,
  })

  const { data: engagements } = useQuery({
    queryKey: ['engagements', 'client', id],
    queryFn: () => dp.listEngagements(scope, { client_id: id }),
    enabled: !!client,
  })

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => dp.listProducts(),
    enabled: !!client,
  })

  const { data: clientProjects, isLoading: loadingProjects } = useQuery({
    queryKey: ['projects', 'client', id],
    queryFn: () => dp.listProjects(scope, { client_id: id }),
    enabled: !!client,
  })

  const { data: allFeedback, isLoading: loadingFeedback } = useQuery({
    queryKey: ['feedback', session.userId],
    queryFn: () => dp.listFeedback(scope),
    enabled: !!client,
  })

  if (loadingClient) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )

  if (error || !client) return <ErrorState message="Client not found or access denied." onRetry={refetch} />

  const cases = casesPage?.items ?? []
  const contactEmail = client.email ?? linkedUser?.email
  const productsMap = Object.fromEntries((products ?? []).map((p) => [p.id, p]))
  const productLines = (engagements ?? []).flatMap((e) => e.products.map((line) => ({ engagementId: e.id, line })))

  const openCases = cases.filter((c: Case) => !['closed', 'resolved', 'pending_closure'].includes(c.status))
  const criticalCases = cases.filter((c: Case) => c.priority === 'critical' && !['closed'].includes(c.status))
  const escalatedCases = cases.filter((c: Case) => c.is_escalated && !['closed'].includes(c.status))
  const resolvedCases = cases.filter((c: Case) => ['resolved', 'closed', 'pending_closure'].includes(c.status))

  const tabbedCases = tab === 'resolved' ? resolvedCases : tab === 'escalated' ? escalatedCases : openCases
  const q = caseSearch.trim().toLowerCase()
  const filteredCases = tabbedCases.filter((c: Case) =>
    !q || c.title.toLowerCase().includes(q) || c.reference_no.toLowerCase().includes(q)
  )

  const projects = clientProjects ?? []
  const clientFeedback = (allFeedback ?? []).filter((f: Feedback) => f.client_id === id)
  const ratedFeedback = clientFeedback.filter((f) => f.rating != null)
  const satisfaction = ratedFeedback.length > 0
    ? Math.round((ratedFeedback.reduce((s, f) => s + (f.rating ?? 0), 0) / ratedFeedback.length) * 10) / 10
    : null

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex items-start gap-4 flex-1 min-w-0">
          <div className="rounded-xl bg-primary/15 p-3 shrink-0">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{client.company_name}</h1>
              {client.account_tier && (
                <Badge variant="outline" className="text-xs capitalize">{client.account_tier}</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                <UserIcon className="h-3 w-3" /> {client.contact_person}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium">
                <Phone className="h-3 w-3" /> {client.phone}
              </span>
              {client.industry && (
                <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium">
                  <Activity className="h-3 w-3" /> {client.industry}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Client since {formatDate(client.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Open" value={openCases.length} icon={Ticket} loading={loadingCases} />
        <StatCard title="Critical" value={criticalCases.length} icon={AlertTriangle} iconColor="text-red-500" loading={loadingCases} />
        <StatCard title="Escalated" value={escalatedCases.length} icon={Clock} iconColor="text-amber-500" loading={loadingCases} />
        <StatCard title="Resolved" value={resolvedCases.length} icon={CheckCircle2} iconColor="text-emerald-500" loading={loadingCases} />
        <StatCard
          title="Satisfaction"
          value={satisfaction != null ? `${satisfaction}/5` : '—'}
          subtitle={ratedFeedback.length > 0 ? `${ratedFeedback.length} rated review${ratedFeedback.length !== 1 ? 's' : ''}` : 'No ratings yet'}
          icon={Star}
          iconColor="text-amber-500"
          loading={loadingFeedback}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Cases / Projects / Feedback */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs value={view} onValueChange={(v) => router.replace(`${pathname}?view=${v}`, { scroll: false })}>
            <TabsList>
              <TabsTrigger value="cases" className="gap-1.5">
                <Ticket className="h-3.5 w-3.5" /> Cases <span className="text-muted-foreground">({cases.length})</span>
              </TabsTrigger>
              <TabsTrigger value="projects" className="gap-1.5">
                <FolderKanban className="h-3.5 w-3.5" /> Projects <span className="text-muted-foreground">({projects.length})</span>
              </TabsTrigger>
              <TabsTrigger value="feedback" className="gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" /> Feedback <span className="text-muted-foreground">({clientFeedback.length})</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {view === 'cases' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <SearchInput
                  containerClassName="flex-1 min-w-48"
                  className="h-9"
                  placeholder="Search cases…"
                  value={caseSearch}
                  onChange={setCaseSearch}
                  resultCount={filteredCases.length}
                  resultLabel="case"
                />
                <Select value={tab} onValueChange={(v) => router.replace(`${pathname}?view=cases&tab=${v}`, { scroll: false })}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active ({openCases.length})</SelectItem>
                    <SelectItem value="resolved">Resolved ({resolvedCases.length})</SelectItem>
                    <SelectItem value="escalated">Escalated ({escalatedCases.length})</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loadingCases ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
              ) : filteredCases.length === 0 ? (
                <EmptyState
                  icon={Ticket}
                  title={q ? `No results found for "${caseSearch}"` : tab === 'resolved' ? 'No resolved cases' : tab === 'escalated' ? 'No escalated cases' : 'No open cases'}
                  description={q ? 'Try a different search.' : `This client has no ${tab} support cases.`}
                />
              ) : (
                <div className="space-y-3">
                  {filteredCases.map((c: Case) => (
                    <CaseCard key={c.id} case_={c} href={`/cases/${c.id}`} />
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'projects' && (
            loadingProjects ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
            ) : projects.length === 0 ? (
              <EmptyState icon={FolderKanban} title="No projects" description="This client has no projects yet." />
            ) : (
              <div className="space-y-3">
                {projects.map((p: Project) => (
                  <div
                    key={p.id}
                    className="rounded-xl border bg-card p-4 flex items-center justify-between gap-3 transition-all hover:border-primary/40 hover:shadow-md cursor-pointer"
                    onClick={() => router.push(`/projects/${p.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{p.title}</p>
                      {p.description && <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{p.description}</p>}
                    </div>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full shrink-0', PROJECT_STATUS_COLORS[p.status])}>
                      {PROJECT_STATUS_LABELS[p.status]}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}

          {view === 'feedback' && (
            loadingFeedback ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
            ) : clientFeedback.length === 0 ? (
              <EmptyState icon={MessageCircle} title="No feedback" description="This client hasn't left any feedback yet." />
            ) : (
              <div className="space-y-3">
                {clientFeedback.map((f: Feedback) => (
                  <div key={f.id} className="rounded-xl border bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <StarRow rating={f.rating} />
                      <span className="text-xs text-muted-foreground">{formatDate(f.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground line-clamp-3">{f.feedback_text}</p>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4 space-y-2.5">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" /> Products
            </h3>
            {productLines.length === 0 ? (
              <p className="text-xs text-muted-foreground">No products engaged.</p>
            ) : (
              <div className="space-y-1.5">
                {productLines.map(({ engagementId, line }) => {
                  const product = productsMap[line.product_id]
                  const meta = product ? getCategoryMeta(product.category) : null
                  const isExpired = !!line.expires_at && new Date(line.expires_at) < new Date()
                  const showExpiry = line.types.some((t) => t === 'poc' || t === 'support')
                  return (
                    <div key={`${engagementId}-${line.id}`} className="rounded-lg border px-2.5 py-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        {meta ? (
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold shrink-0"
                            style={{ background: meta.tint, color: meta.color }}
                          >
                            {meta.mono}
                          </div>
                        ) : (
                          <div className="rounded-lg bg-primary/10 p-1.5 shrink-0">
                            <Package className="h-3.5 w-3.5 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{product?.name ?? line.oem}</p>
                          {product?.category && <p className="text-[11px] text-muted-foreground truncate">{product.category}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {line.types.map((lt) => {
                          const TypeIcon = TYPE_ICONS[lt]
                          return (
                            <span key={lt} className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', TYPE_COLORS[lt])}>
                              <TypeIcon className="h-2.5 w-2.5" /> {TYPE_LABELS[lt]}
                            </span>
                          )
                        })}
                        {showExpiry && (
                          line.expires_at ? (
                            <span className={cn(
                              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                              isExpired ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-950 dark:text-amber-400'
                            )}>
                              <Clock className="h-2.5 w-2.5" /> {isExpired ? 'Expired' : 'Expires'} {formatDate(line.expires_at)}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              <Clock className="h-2.5 w-2.5" /> No expiry set
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4 space-y-3">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <UserIcon className="h-3.5 w-3.5" /> Contact Details
            </h3>
            <div className="flex items-center gap-3">
              <UserAvatar name={client.contact_person} size="lg" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{client.contact_person}</p>
                {client.contact_designation && (
                  <p className="text-xs text-muted-foreground truncate">{client.contact_designation}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5 pt-2 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-foreground">{client.phone}</span>
              </div>
              {contactEmail && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-foreground truncate">{contactEmail}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}