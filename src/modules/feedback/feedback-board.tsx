'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useAuth } from '@/lib/auth/context'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn, formatDate } from '@/lib/utils'
import { canAccess } from '@/lib/rbac'
import { FEEDBACK_QUESTIONS } from '@/lib/feedback-questions'
import { Star, CheckCircle2, Search, X, ChevronDown, ChevronRight } from 'lucide-react'
import { CreateFeedbackDialog } from './create-feedback-dialog'
import type { Feedback, Client, Case, Team, User } from '@/types'

function StarRating({ rating }: { rating?: number }) {
  if (!rating) return <span className="text-xs text-muted-foreground">No rating</span>
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-4 w-4 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  )
}

interface FeedbackBoardProps {
  /** When true, scope the feedback to cases assigned to the logged-in support engineer. */
  mine?: boolean
  title?: string
  description?: string
}

export function FeedbackBoard({ mine = false, title = 'Feedback', description }: FeedbackBoardProps) {
  const { session } = useAuth()
  const dp = getDataProvider()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const tab = searchParams.get('tab') || 'new'

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [teamFilter, setTeamFilter] = useState('all')
  const [engineerFilter, setEngineerFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')

  const { data: feedback, isLoading } = useQuery({
    queryKey: ['feedback', session?.userId],
    queryFn: () => dp.listFeedback({ userId: session!.userId, role: session!.role }),
    enabled: !!session,
  })

  const { data: clients } = useQuery({
    queryKey: ['clients', session?.userId],
    queryFn: () => dp.listClients({ userId: session!.userId, role: session!.role }),
    enabled: !!session,
  })

  const { data: casesPage } = useQuery({
    queryKey: ['cases', 'all', session?.userId],
    queryFn: () => dp.listCases({ userId: session!.userId, role: session!.role }, { pageSize: 500 }),
    enabled: !!session,
  })

  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })

  const clientsMap = Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c]))
  const casesMap = Object.fromEntries((casesPage?.items ?? []).map((c: Case) => [c.id, c]))
  const teamsMap = Object.fromEntries((teams ?? []).map((t: Team) => [t.id, t]))
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))

  if (!session) return null

  const scope = { userId: session.userId, role: session.role }
  const canReview = canAccess(scope, 'review_feedback', 'feedback')
  const isClient = session.role === 'client'

  // When scoped to "my feedback", only show feedback for cases assigned to the
  // logged-in support engineer. listCases already filters to their assigned
  // cases for the support_engineer role, so the case map keys are exactly the
  // engineer's own cases.
  const visibleFeedback = (feedback ?? []).filter((f: Feedback) =>
    mine ? Boolean(casesMap[f.case_id]) : true
  )

  // Filter option lists — only values actually present in the current feedback
  // set, so every choice is guaranteed to return at least one result.
  const teamOptions = Array.from(
    new Map(
      visibleFeedback
        .map((f: Feedback) => casesMap[f.case_id]?.team_id)
        .filter((id): id is string => Boolean(id))
        .map((id) => [id, teamsMap[id]?.name ?? 'Unknown team'])
    ).entries()
  ).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))

  const engineerOptions = Array.from(
    new Map(
      visibleFeedback
        .map((f: Feedback) => casesMap[f.case_id]?.assignee_id)
        .filter((id): id is string => Boolean(id))
        .map((id) => [id, usersMap[id]?.name ?? 'Unknown engineer'])
    ).entries()
  ).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))

  const clientOptions = Array.from(
    new Map(
      visibleFeedback
        .map((f: Feedback) => f.client_id)
        .filter(Boolean)
        .map((id) => [id, clientsMap[id]?.company_name ?? 'Unknown client'])
    ).entries()
  ).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))

  const hasActiveFilters = teamFilter !== 'all' || engineerFilter !== 'all' || clientFilter !== 'all' || !!dateFilter
  const hasSearchQuery = searchQuery.trim().length > 0
  const hasAnyFilter = hasActiveFilters || hasSearchQuery

  const clearFilters = () => {
    setTeamFilter('all')
    setEngineerFilter('all')
    setClientFilter('all')
    setDateFilter('')
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const searchNeedle = searchQuery.trim().toLowerCase()
  const filteredFeedback = visibleFeedback.filter((f: Feedback) => {
    const relatedCase = casesMap[f.case_id]
    if (teamFilter !== 'all' && relatedCase?.team_id !== teamFilter) return false
    if (engineerFilter !== 'all' && relatedCase?.assignee_id !== engineerFilter) return false
    if (clientFilter !== 'all' && f.client_id !== clientFilter) return false
    if (dateFilter && new Date(f.created_at).toISOString().slice(0, 10) !== dateFilter) return false
    if (searchNeedle) {
      const client = clientsMap[f.client_id]
      const engineer = relatedCase?.assignee_id ? usersMap[relatedCase.assignee_id] : undefined
      const haystack = [relatedCase?.title, f.feedback_text, client?.company_name, engineer?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(searchNeedle)) return false
    }
    return true
  })

  // Only team_lead/technical_head can review — tabs split their queue into
  // New / reviewed by them / reviewed by the other reviewer role.
  const otherRoleLabel = scope.role === 'team_lead' ? 'Technical Head' : 'Team Lead'
  const reviewedByMe = (f: Feedback) => (scope.role === 'team_lead' ? !!f.ml_reviewed : !!f.th_reviewed)
  const reviewedByOther = (f: Feedback) => (scope.role === 'team_lead' ? !!f.th_reviewed && !f.ml_reviewed : !!f.ml_reviewed && !f.th_reviewed)

  const newFeedback = filteredFeedback.filter((f) => !f.ml_reviewed && !f.th_reviewed)
  const myReviewedFeedback = filteredFeedback.filter(reviewedByMe)
  const otherReviewedFeedback = filteredFeedback.filter(reviewedByOther)

  const tabbedFeedback = !canReview ? filteredFeedback
    : tab === 'reviewed' ? myReviewedFeedback
    : tab === 'reviewed-other' ? otherReviewedFeedback
    : newFeedback

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {description ?? (
              hasAnyFilter
                ? `${filteredFeedback.length} of ${visibleFeedback.length} responses`
                : `${visibleFeedback.length} responses`
            )}
          </p>
        </div>
        <div className={cn('flex items-center gap-2', !isClient && 'w-full sm:w-auto')}>
          {!isClient && (
            <SearchInput
              containerClassName="min-w-0 flex-1 sm:w-64 sm:flex-none"
              placeholder="Search case title, feedback…"
              value={searchQuery}
              onChange={setSearchQuery}
              aria-label="Search feedback"
              className="h-9"
            />
          )}
          {!isClient && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('shrink-0', hasActiveFilters && 'border-primary/50 text-primary')}>
                  <Search className="h-4 w-4" />
                  Search
                  {hasActiveFilters && (
                    <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 text-xs font-semibold">
                      {[teamFilter !== 'all', engineerFilter !== 'all', clientFilter !== 'all', !!dateFilter].filter(Boolean).length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-3" align="end">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Search feedback</p>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={clearFilters}>
                      <X className="h-3 w-3" /> Clear
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Team Name</Label>
                  <Select value={teamFilter} onValueChange={setTeamFilter}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All Teams" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Teams</SelectItem>
                      {teamOptions.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Support Engineer</Label>
                  <Select value={engineerFilter} onValueChange={setEngineerFilter}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All Engineers" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Engineers</SelectItem>
                      {engineerOptions.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Client Name</Label>
                  <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All Clients" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {clientOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </PopoverContent>
            </Popover>
          )}
          {isClient && <CreateFeedbackDialog cases={casesPage?.items ?? []} />}
        </div>
      </div>

      {canReview && (
        <Tabs value={tab} onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}>
          <TabsList className="grid h-auto w-full max-w-full grid-flow-col auto-cols-fr gap-1 p-1">
            <TabsTrigger value="new" className="w-full min-w-0 truncate">
              <span className="truncate">New</span> <span className="ml-1 text-muted-foreground shrink-0">({newFeedback.length})</span>
            </TabsTrigger>
            <TabsTrigger value="reviewed" className="w-full min-w-0 truncate">
              <span className="truncate">Reviewed</span> <span className="ml-1 text-muted-foreground shrink-0">({myReviewedFeedback.length})</span>
            </TabsTrigger>
            <TabsTrigger value="reviewed-other" className="w-full min-w-0 truncate">
              <span className="truncate">Reviewed by {otherRoleLabel}</span> <span className="ml-1 text-muted-foreground shrink-0">({otherReviewedFeedback.length})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : tabbedFeedback.length === 0 ? (
        <EmptyState
          icon={Star}
          title={hasAnyFilter ? 'No feedback matches these filters' : 'No feedback yet'}
          description={hasAnyFilter ? 'Try a different search term, team, engineer, client or date.' : 'Feedback from resolved cases will appear here.'}
        />
      ) : (
        <div className="space-y-3">
          {tabbedFeedback.map((f: Feedback) => {
            const client = clientsMap[f.client_id]
            const relatedCase = casesMap[f.case_id]
            const team = relatedCase?.team_id ? teamsMap[relatedCase.team_id] : undefined
            const engineer = relatedCase?.assignee_id ? usersMap[relatedCase.assignee_id] : undefined

            return (
              <div key={f.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* Main content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {isClient
                          ? (engineer?.name ?? 'Support Engineer')
                          : (client?.company_name ?? f.client_id)}
                      </span>
                      <div className="flex items-center gap-2">
                        <StarRating rating={f.rating} />
                        <button
                          type="button"
                          onClick={() => toggleExpand(f.id)}
                          className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {expanded.has(f.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          Breakdown
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{f.feedback_text}</p>

                    {expanded.has(f.id) && (
                      <div className="rounded-lg bg-muted/30 p-3 divide-y divide-border/60">
                        {FEEDBACK_QUESTIONS.map((q) => (
                          <div key={q.key} className="flex items-center justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                            <span className="text-xs text-muted-foreground">{q.label}</span>
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }, (_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3 w-3 ${(f.question_ratings?.[q.key] ?? 0) > i ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/25'}`}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {team && <span>{team.name}</span>}
                      {engineer && !isClient && <span>{engineer.name}</span>}
                      <span>{formatDate(f.created_at)}</span>
                      {!isClient && (
                        f.ml_reviewed && f.th_reviewed ? (
                          <span className="flex items-center gap-1 text-emerald-600 font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Reviewed by ML &amp; TH
                          </span>
                        ) : f.ml_reviewed ? (
                          <span className="flex items-center gap-1 text-emerald-600 font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Reviewed by Team Lead
                          </span>
                        ) : f.th_reviewed ? (
                          <span className="flex items-center gap-1 text-emerald-600 font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Reviewed by Technical Head
                          </span>
                        ) : null
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 border-t pt-3 sm:flex-col sm:items-stretch sm:border-t-0 sm:pt-0 sm:shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 flex-1 text-xs px-3 sm:flex-none"
                      onClick={() => router.push(`/cases/${f.case_id}`)}
                    >
                      View Case
                    </Button>
                    {canReview && (
                      reviewedByMe(f) ? (
                        <span className="h-7 flex flex-1 items-center justify-center gap-1 text-xs px-3 font-medium text-emerald-600 sm:flex-none">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Reviewed
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 flex-1 text-xs px-3 text-primary sm:flex-none"
                          onClick={() => router.push(`/feedback/${f.id}/reviews/${f.id}`)}
                        >
                          Review
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
