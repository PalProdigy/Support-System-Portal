'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Calendar, toDateKey } from '@/components/ui/calendar'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { CaseCard } from '@/components/shared/case-card'
import { KBStatusBadge } from '@/modules/kb/status-badge'
import { canReviewKB, canWriteKB, KB_CATEGORIES } from '@/modules/kb/constants'
import { estimateReadingTimeMinutes, slugify } from '@/lib/markdown/utils'
import { cn, formatDate } from '@/lib/utils'
import {
  BookOpen, ClipboardList, Clock, FolderOpen, MessageCircle, PenLine, PlusCircle,
  Tag, User as UserIcon, X, CheckCircle2, Filter, CalendarDays,
} from 'lucide-react'
import type { Case, Client, KBArticle, User } from '@/types'

type Shelf = 'browse' | 'mine' | 'review' | 'closed_cases'

/**
 * Knowledge Base home: documentation-portal browsing experience — hero search,
 * category chips, tag filters and a card grid. Staff get a New Article button
 * and a "My Articles" shelf; reviewers (TL/TH) also get the Review Queue.
 * Clients see published articles only (enforced by the data layer).
 */
function KnowledgeBaseIndex() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const searchParams = useSearchParams()
  const scope = { userId: session.userId, role: session.role }

  const [query, setQuery] = useState('')
  const [shelf, setShelf] = useState<Shelf>('browse')
  const [dateFilter, setDateFilter] = useState<Date | null>(null)
  const [dateOpen, setDateOpen] = useState(false)
  const [teamFilter, setTeamFilter] = useState('all')
  const [engineerFilter, setEngineerFilter] = useState('all')
  const [serviceFilter, setServiceFilter] = useState('all')
  const category = searchParams.get('category')
  const tag = searchParams.get('tag')

  const writer = canWriteKB(session.role)
  const reviewer = canReviewKB(session.role)

  const { data: articles, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['kb', 'index', session.userId, query],
    queryFn: () => dp.listKBArticles({ search: query || undefined }, scope),
  })

  // Closed Cases shelf — resolved/closed support cases, scoped the same way
  // the Cases page is (each role only sees what it's entitled to).
  const { data: closedCasesData, isLoading: closedCasesLoading } = useQuery({
    queryKey: ['cases', 'closed', session.userId],
    queryFn: () => dp.listCases(scope, { status: 'closed', pageSize: 200, top_level_only: true }),
    enabled: writer,
  })
  const { data: clients } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
    enabled: writer,
  })
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => dp.listUsers(),
    enabled: writer,
  })
  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => dp.listTeams(),
    enabled: writer,
  })
  const { data: solutions } = useQuery({
    queryKey: ['solutions'],
    queryFn: () => dp.listSolutions(),
    enabled: writer,
  })

  const all = useMemo(() => articles ?? [], [articles])
  const publishedAll = useMemo(() => all.filter((a) => a.status === 'published'), [all])
  const mine = useMemo(() => all.filter((a) => a.author_id === session.userId), [all, session.userId])
  const reviewQueue = useMemo(() => all.filter((a) => a.status === 'in_review'), [all])
  const closedCases = useMemo(() => closedCasesData?.items ?? [], [closedCasesData])
  const clientsMap = useMemo(() => Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c])), [clients])
  const usersMap = useMemo(() => Object.fromEntries((users ?? []).map((u: User) => [u.id, u])), [users])
  const teamsMap = useMemo(() => Object.fromEntries((teams ?? []).map((t) => [t.id, t.name])), [teams])
  const solutionsMap = useMemo(() => Object.fromEntries((solutions ?? []).map((s) => [s.id, s.name])), [solutions])

  const isClosedCasesShelf = shelf === 'closed_cases'
  const shelfArticles = shelf === 'mine' ? mine : shelf === 'review' ? reviewQueue : publishedAll

  // Category chips: the curated list, with live counts from the current shelf.
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of shelfArticles) if (a.category) counts.set(a.category, (counts.get(a.category) ?? 0) + 1)
    return counts
  }, [shelfArticles])

  const visible = useMemo(() => {
    let list = shelfArticles
    if (category) list = list.filter((a) => a.category === category)
    if (tag) list = list.filter((a) => a.tags.includes(tag))
    return [...list].sort((a, b) =>
      new Date(b.published_at ?? b.updated_at).getTime() - new Date(a.published_at ?? a.updated_at).getTime())
  }, [shelfArticles, category, tag])

  // Dates that have at least one closed case — drives the "has data" dot in the calendar.
  const closedCaseDateKeys = useMemo(() => {
    const set = new Set<string>()
    for (const c of closedCases) set.add(toDateKey(new Date(c.closed_at ?? c.created_at)))
    return set
  }, [closedCases])

  // Filter option lists — only values actually present among closed cases, so every
  // choice is guaranteed to return at least one result.
  const teamOptions = useMemo(() => {
    const ids = new Set(closedCases.map((c) => c.team_id).filter(Boolean) as string[])
    return [...ids].map((id) => ({ id, name: teamsMap[id] ?? 'Unknown team' })).sort((a, b) => a.name.localeCompare(b.name))
  }, [closedCases, teamsMap])

  const engineerOptions = useMemo(() => {
    const ids = new Set(closedCases.map((c) => c.assignee_id).filter(Boolean) as string[])
    return [...ids].map((id) => ({ id, name: usersMap[id]?.name ?? 'Unknown engineer' })).sort((a, b) => a.name.localeCompare(b.name))
  }, [closedCases, usersMap])

  const serviceOptions = useMemo(() => {
    const ids = new Set(closedCases.map((c) => c.solution_id).filter(Boolean) as string[])
    return [...ids].map((id) => ({ id, name: solutionsMap[id] ?? 'Unknown service' })).sort((a, b) => a.name.localeCompare(b.name))
  }, [closedCases, solutionsMap])

  const hasActiveCaseFilters = !!dateFilter || teamFilter !== 'all' || engineerFilter !== 'all' || serviceFilter !== 'all'

  const clearCaseFilters = () => {
    setDateFilter(null)
    setTeamFilter('all')
    setEngineerFilter('all')
    setServiceFilter('all')
  }

  const visibleClosedCases = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = q
      ? closedCases.filter((c: Case) => c.title.toLowerCase().includes(q) || c.reference_no.toLowerCase().includes(q))
      : closedCases

    if (dateFilter) {
      const key = toDateKey(dateFilter)
      list = list.filter((c) => toDateKey(new Date(c.closed_at ?? c.created_at)) === key)
    }
    if (teamFilter !== 'all') list = list.filter((c) => c.team_id === teamFilter)
    if (engineerFilter !== 'all') list = list.filter((c) => c.assignee_id === engineerFilter)
    if (serviceFilter !== 'all') list = list.filter((c) => c.solution_id === serviceFilter)

    return [...list].sort((a, b) =>
      new Date(b.closed_at ?? b.created_at).getTime() - new Date(a.closed_at ?? a.created_at).getTime())
  }, [closedCases, query, dateFilter, teamFilter, engineerFilter, serviceFilter])

  const setFilter = (key: 'category' | 'tag', value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value); else params.delete(key)
    router.replace(`/knowledge-base${params.size ? `?${params}` : ''}`)
  }

  if (error) return <div className="p-6"><ErrorState onRetry={refetch} /></div>

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5">
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-card p-6 sm:p-8 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Knowledge Base</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Guides, troubleshooting and best practices — solve it before it becomes a ticket.
            </p>
          </div>
          {writer && (
            <Button onClick={() => router.push('/knowledge-base/new')}>
              <PlusCircle className="h-4 w-4" /> New Article
            </Button>
          )}
        </div>
        <div className="max-w-2xl">
          <SearchInput
            value={query}
            onChange={setQuery}
            debounceMs={350}
            minChars={2}
            loading={isFetching}
            placeholder={isClosedCasesShelf ? 'Search by title or reference…' : 'Search by title, content, tags, category or author…'}
            className="h-11 text-base bg-background"
            aria-label={isClosedCasesShelf ? 'Search closed cases' : 'Search articles'}
            resultCount={isClosedCasesShelf ? visibleClosedCases.length : visible.length}
            resultLabel={isClosedCasesShelf ? 'case' : 'article'}
          />
        </div>
      </div>

      {/* ── Shelves (staff) ──────────────────────────────────────────────────── */}
      {writer && (
        <Tabs value={shelf} onValueChange={(v) => setShelf(v as Shelf)}>
          <TabsList>
            <TabsTrigger value="browse" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Browse ({publishedAll.length})</TabsTrigger>
            <TabsTrigger value="mine" className="gap-1.5"><PenLine className="h-3.5 w-3.5" /> My Articles ({mine.length})</TabsTrigger>
            {reviewer && (
              <TabsTrigger value="review" className={cn('gap-1.5', reviewQueue.length > 0 && 'text-amber-600 dark:text-amber-400')}>
                <ClipboardList className="h-3.5 w-3.5" /> Review Queue ({reviewQueue.length})
              </TabsTrigger>
            )}
            <TabsTrigger value="closed_cases" className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Closed Cases ({closedCases.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* ── Category chips + active filters ──────────────────────────────────── */}
      {!isClosedCasesShelf && (
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryChip label="All" active={!category} onClick={() => setFilter('category', null)} />
          {KB_CATEGORIES.filter((c) => (categoryCounts.get(c) ?? 0) > 0).map((c) => (
            <CategoryChip
              key={c}
              label={`${c} (${categoryCounts.get(c)})`}
              active={category === c}
              onClick={() => setFilter('category', category === c ? null : c)}
            />
          ))}
          {tag && (
            <button
              type="button"
              onClick={() => setFilter('tag', null)}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium hover:bg-primary/20"
            >
              <Tag className="h-3 w-3" /> {tag} <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* ── Closed Cases filters ─────────────────────────────────────────────── */}
      {isClosedCasesShelf && (
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={query}
            onChange={setQuery}
            debounceMs={350}
            minChars={2}
            loading={isFetching}
            placeholder="Search by title or reference…"
            containerClassName="w-56 shrink-0"
            className="h-8 text-sm"
            aria-label="Search closed cases"
            resultCount={visibleClosedCases.length}
            resultLabel="case"
          />

          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground shrink-0">Filter by</span>

          {/* Date — opens a calendar; days with a closed case carry a dot */}
          <div className="flex items-stretch shrink-0">
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex h-8 items-center gap-1.5 border border-input bg-transparent px-3 text-sm shadow-sm hover:bg-muted/50 transition-colors rounded-md',
                    dateFilter && 'border-primary/50 text-primary rounded-r-none border-r-0',
                  )}
                >
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  {dateFilter ? formatDate(dateFilter.toISOString()) : 'Date'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Calendar
                  selected={dateFilter ?? undefined}
                  onSelect={(d) => { setDateFilter(d); setDateOpen(false) }}
                  markedDates={closedCaseDateKeys}
                />
              </PopoverContent>
            </Popover>
            {dateFilter && (
              <button
                type="button"
                aria-label="Clear date filter"
                onClick={() => setDateFilter(null)}
                className="flex h-8 items-center rounded-r-md border border-l-0 border-primary/50 px-1.5 text-primary hover:bg-primary/10 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Team Name */}
          <div className="w-40 shrink-0">
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="h-8 w-full text-sm"><SelectValue placeholder="Team Name" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teamOptions.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Support Engineer Name */}
          <div className="w-48 shrink-0">
            <Select value={engineerFilter} onValueChange={setEngineerFilter}>
              <SelectTrigger className="h-8 w-full text-sm"><SelectValue placeholder="Support Engineer Name" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Engineers</SelectItem>
                {engineerOptions.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Service */}
          <div className="w-40 shrink-0">
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="h-8 w-full text-sm"><SelectValue placeholder="Service" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {serviceOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {hasActiveCaseFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground shrink-0" onClick={clearCaseFilters}>
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      )}

      {/* ── Closed Cases list ────────────────────────────────────────────────── */}
      {isClosedCasesShelf ? (
        closedCasesLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : visibleClosedCases.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={query ? `No results found for "${query}"` : hasActiveCaseFilters ? 'No cases match these filters' : 'No closed cases'}
            description={
              query
                ? 'Try different keywords.'
                : hasActiveCaseFilters
                  ? 'Try a different date, team, engineer or service.'
                  : 'Cases that have been closed will appear here.'
            }
          />
        ) : (
          <div className="space-y-3">
            {visibleClosedCases.map((c: Case) => (
              <CaseCard
                key={c.id}
                case_={c}
                client={clientsMap[c.client_id]}
                assignee={c.assignee_id ? usersMap[c.assignee_id] : undefined}
                href={`/cases/${c.id}`}
              />
            ))}
          </div>
        )
      ) : (
        /* ── Article grid ───────────────────────────────────────────────────── */
        isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={shelf === 'review' ? ClipboardList : BookOpen}
            title={query ? `No results found for "${query}"` : shelf === 'review' ? 'Nothing to review' : 'No articles found'}
            description={
              query || category || tag
                ? 'Try different keywords or clear the filters.'
                : shelf === 'mine'
                  ? 'Write your first article — click "New Article" to get started.'
                  : shelf === 'review'
                    ? 'Submitted articles will appear here for approval.'
                    : 'No published articles yet.'
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {visible.map((a) => (
              <ArticleCard key={a.id} article={a} showStatus={shelf !== 'browse'} onTag={(t) => setFilter('tag', t)} />
            ))}
          </div>
        )
      )}
    </div>
  )
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground hover:border-primary/40',
      )}
    >
      {label}
    </button>
  )
}

function ArticleCard({ article: a, showStatus, onTag }: {
  article: KBArticle
  showStatus: boolean
  onTag: (tag: string) => void
}) {
  const href = `/knowledge-base/${a.slug ?? slugify(a.title)}`
  return (
    <div className="group relative rounded-xl border bg-card p-4 flex flex-col gap-2 hover:shadow-sm hover:border-primary/40 transition-all">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {a.category && (
          <span className="inline-flex items-center gap-1 font-medium text-primary">
            <FolderOpen className="h-3 w-3" /> {a.category}
          </span>
        )}
        {showStatus && <KBStatusBadge status={a.status} />}
      </div>
      <Link href={href} className="focus-visible:outline-none">
        {/* stretched link — whole card is clickable */}
        <span className="absolute inset-0" aria-hidden />
        <h3 className="font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">{a.title}</h3>
      </Link>
      {a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
      {a.tags.length > 0 && (
        <div className="relative flex items-center gap-1.5 flex-wrap">
          {a.tags.slice(0, 4).map((t) => (
            <button key={t} type="button" onClick={() => onTag(t)} className="relative z-10">
              <Badge variant="secondary" className="text-[11px] hover:bg-secondary/70 cursor-pointer">{t}</Badge>
            </button>
          ))}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" /> {a.author_name ?? a.author_id}</span>
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {estimateReadingTimeMinutes(a.body)} min read</span>
        <span>{a.published_at ? formatDate(a.published_at) : `Updated ${formatDate(a.updated_at)}`}</span>
        {(a.comments ?? []).length > 0 && (
          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {(a.comments ?? []).length}</span>
        )}
      </div>
    </div>
  )
}

export default function KnowledgeBasePage() {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-40 rounded-2xl" /></div>}>
      <KnowledgeBaseIndex />
    </Suspense>
  )
}
