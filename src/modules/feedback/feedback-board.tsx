'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useAuth } from '@/lib/auth/context'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { canAccess } from '@/lib/rbac'
import { Star, CheckCircle2 } from 'lucide-react'
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

  // When scoped to "my feedback", only show feedback for cases assigned to the
  // logged-in support engineer. listCases already filters to their assigned
  // cases for the support_engineer role, so the case map keys are exactly the
  // engineer's own cases.
  const visibleFeedback = (feedback ?? []).filter((f: Feedback) =>
    mine ? Boolean(casesMap[f.case_id]) : true
  )

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description ?? `${visibleFeedback.length} responses`}</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : visibleFeedback.length === 0 ? (
        <EmptyState icon={Star} title="No feedback yet" description="Feedback from resolved cases will appear here." />
      ) : (
        <div className="space-y-3">
          {visibleFeedback.map((f: Feedback) => {
            const client = clientsMap[f.client_id]
            const relatedCase = casesMap[f.case_id]
            const team = relatedCase?.team_id ? teamsMap[relatedCase.team_id] : undefined
            const engineer = relatedCase?.assignee_id ? usersMap[relatedCase.assignee_id] : undefined

            return (
              <div key={f.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  {/* Main content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-medium">{client?.company_name ?? f.client_id}</span>
                      <StarRating rating={f.rating} />
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{f.feedback_text}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {team && <span>{team.name}</span>}
                      {engineer && <span>{engineer.name}</span>}
                      <span>{formatDate(f.created_at)}</span>
                      {f.ml_reviewed && f.th_reviewed ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Reviewed by ML &amp; TH
                        </span>
                      ) : f.ml_reviewed ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Reviewed by Module Lead
                        </span>
                      ) : f.th_reviewed ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Reviewed by Technical Head
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-3"
                      onClick={() => router.push(`/cases/${f.case_id}`)}
                    >
                      View Case
                    </Button>
                    {canReview && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs px-3 text-primary"
                        onClick={() => router.push(`/feedback/${f.id}/reviews/${f.id}`)}
                      >
                        Review
                      </Button>
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
