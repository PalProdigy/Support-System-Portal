'use client'

import { use } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { canAccess } from '@/lib/rbac'
import { toast } from '@/hooks/use-toast'
import { formatDateTime, getInitials, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'
import {
  ArrowLeft, Star, MessageSquare, Ticket,
  Briefcase, Calendar, CheckCircle2, Building2,
  UserIcon, Clock, Users, ShieldCheck,
} from 'lucide-react'
import type { Feedback, Case, Client, User, Team, Solution } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────
function computeDuration(startIso: string, endIso?: string): string {
  if (!endIso) return 'Ongoing'
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (ms <= 0) return '—'
  const totalMins = Math.floor(ms / 60000)
  const days = Math.floor(totalMins / 1440)
  const hrs = Math.floor((totalMins % 1440) / 60)
  const mins = totalMins % 60
  if (days > 0) return hrs > 0 ? `${days}d ${hrs}h` : `${days}d`
  if (hrs > 0) return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
  return `${mins}m`
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StarRow({ rating, size = 'md' }: { rating?: number; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${cls} ${n <= (rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25'}`} />
      ))}
    </div>
  )
}

function InitialsAvatar({ name }: { name: string }) {
  return (
    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-semibold text-sm flex items-center justify-center shrink-0">
      {getInitials(name)}
    </div>
  )
}

function PersonCard({ icon, label, name, sub, emptyText = 'Not available' }: {
  icon: React.ReactNode; label: string; name?: string; sub?: string; emptyText?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {icon} {label}
      </p>
      {name ? (
        <div className="flex items-center gap-3">
          <InitialsAvatar name={name} />
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{name}</p>
            {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">{emptyText}</p>
      )}
    </div>
  )
}

function MetaRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ReviewDetailPage({ params }: { params: Promise<{ feedbackId: string; id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const { data: allFeedback, isLoading } = useQuery({
    queryKey: ['feedback', scope.userId],
    queryFn: () => dp.listFeedback(scope),
  })
  const { data: clients } = useQuery({ queryKey: ['clients', scope.userId], queryFn: () => dp.listClients(scope) })
  const { data: casesPage } = useQuery({
    queryKey: ['cases', 'all'],
    queryFn: () => dp.listCases(scope, { pageSize: 500 }),
  })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
  const { data: solutions } = useQuery({ queryKey: ['solutions'], queryFn: () => dp.listSolutions() })

  const reviewMutation = useMutation({
    mutationFn: () => {
      const patch = scope.role === 'module_lead'
        ? { ml_reviewed: true }
        : { th_reviewed: true }
      return dp.updateFeedback(id, patch)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback'] })
      toast({ title: 'Marked as reviewed', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  })

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col lg:h-full">
        <div className="px-6 pt-5 pb-0 shrink-0"><Skeleton className="h-8 w-28" /></div>
        <div className="flex flex-col lg:flex-row gap-5 p-6 pt-4 lg:flex-1 lg:min-h-0">
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
          <Skeleton className="w-full lg:w-52 h-64 rounded-xl shrink-0 lg:self-start" />
        </div>
      </div>
    )
  }

  // ── Not found ───────────────────────────────────────────────────────────────
  const feedback = (allFeedback ?? []).find((f: Feedback) => f.id === id)

  if (!feedback) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border bg-card p-10 text-center space-y-3">
          <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold">Review not found</h2>
          <p className="text-sm text-muted-foreground">No review matches this ID. It may have been deleted.</p>
          <Button variant="outline" onClick={() => router.push('/feedback')}>Back to Feedback</Button>
        </div>
      </div>
    )
  }

  // ── Resolve related data ────────────────────────────────────────────────────
  const clientsMap = Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c]))
  const casesMap = Object.fromEntries((casesPage?.items ?? []).map((c: Case) => [c.id, c]))
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))
  const teamsMap = Object.fromEntries((teams ?? []).map((t: Team) => [t.id, t]))
  const solutionsMap = Object.fromEntries((solutions ?? []).map((s: Solution) => [s.id, s]))

  const client = clientsMap[feedback.client_id]
  const relatedCase = casesMap[feedback.case_id]
  const engineer = relatedCase?.assignee_id ? usersMap[relatedCase.assignee_id] : undefined
  const team = relatedCase?.team_id ? teamsMap[relatedCase.team_id] : undefined
  const teamLead = team?.lead_user_id ? usersMap[team.lead_user_id] : undefined
  const solution = relatedCase?.solution_id ? solutionsMap[relatedCase.solution_id] : undefined

  const caseEndTime = relatedCase?.resolved_at || relatedCase?.closed_at
  const duration = relatedCase ? computeDuration(relatedCase.created_at, caseEndTime) : '—'

  const canReview = canAccess(scope, 'review_feedback', 'feedback')

  return (
    /*
     * Layout strategy:
     * - Page takes h-full so the <main overflow-y-auto> doesn't scroll
     * - Left column gets its own overflow-y-auto and scrolls independently
     * - Right panel has no overflow → it never moves
     * - On mobile (<lg): stacks vertically, <main> scrolls normally
     */
    <div className="flex flex-col lg:h-full">

      {/* Back — always pinned at top */}
      <div className="px-6 pt-5 pb-0 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => router.push('/feedback')}>
          <ArrowLeft className="h-4 w-4" /> Back to Feedback
        </Button>
      </div>

      {/* Main two-column area */}
      <div className="flex flex-col lg:flex-row gap-5 p-6 pt-4 lg:flex-1 lg:min-h-0">

        {/* ══════════════════════════════════════════════════════
            LEFT — scrolls on desktop, flows on mobile
        ══════════════════════════════════════════════════════ */}
        <div className="flex-1 min-w-0 space-y-4 lg:overflow-y-auto lg:pb-4">

          {/* People: 2×2 grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PersonCard
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Client"
              name={client?.company_name ?? feedback.client_id}
              sub={client?.contact_person}
              emptyText="Unknown client"
            />
            <PersonCard
              icon={<UserIcon className="h-3.5 w-3.5" />}
              label="Support Engineer"
              name={engineer?.name}
              emptyText="Not assigned"
            />
            <PersonCard
              icon={<Users className="h-3.5 w-3.5" />}
              label="Handling Team"
              name={team?.name}
              emptyText="No team assigned"
            />
            <PersonCard
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              label="Team Lead / Module Lead"
              name={teamLead?.name}
              emptyText="No lead found"
            />
          </div>

          {/* Rating + Review text */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Rating
              </p>
              <div className="flex items-center gap-3">
                <StarRow rating={feedback.rating} size="lg" />
                <span className="text-2xl font-bold text-foreground">{feedback.rating ?? '—'}</span>
                <span className="text-base text-muted-foreground">/ 5</span>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Review Comment
              </p>
              <p className="text-foreground leading-relaxed text-sm">{feedback.feedback_text}</p>
            </div>
          </div>

          {/* Case details */}
          <div className="rounded-xl border bg-card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Case Details
            </p>
            <div className="divide-y">
              <MetaRow icon={<Ticket className="h-4 w-4" />} label="Related Ticket">
                {relatedCase ? (
                  <button
                    className="text-sm text-primary font-medium hover:underline text-left"
                    onClick={() => router.push(`/cases/${relatedCase.id}`)}
                  >
                    {relatedCase.reference_no} — {relatedCase.title}
                  </button>
                ) : (
                  <span className="text-sm text-muted-foreground font-mono">{feedback.case_id}</span>
                )}
              </MetaRow>
              <MetaRow icon={<Briefcase className="h-4 w-4" />} label="Support Service">
                <span className="text-sm">{solution?.name ?? <span className="text-muted-foreground">—</span>}</span>
              </MetaRow>
              <MetaRow icon={<Calendar className="h-4 w-4" />} label="Case Create Time">
                <span className="text-sm">{relatedCase ? formatDateTime(relatedCase.created_at) : '—'}</span>
              </MetaRow>
              <MetaRow icon={<Calendar className="h-4 w-4" />} label="Case End Time">
                {caseEndTime
                  ? <span className="text-sm">{formatDateTime(caseEndTime)}</span>
                  : <span className="text-sm text-muted-foreground italic">Not yet closed</span>}
              </MetaRow>
              <MetaRow icon={<Clock className="h-4 w-4" />} label="Duration">
                <span className="text-sm font-medium">{duration}</span>
              </MetaRow>
              <MetaRow icon={<Calendar className="h-4 w-4" />} label="Review Submitted">
                <span className="text-sm">{formatDateTime(feedback.created_at)}</span>
              </MetaRow>
            </div>
          </div>

        </div>

        {/* ══════════════════════════════════════════════════════
            RIGHT — never scrolls; stays fixed while left scrolls
        ══════════════════════════════════════════════════════ */}
        <div className="w-full lg:w-52 shrink-0 lg:self-start">
          <div className="rounded-xl border bg-card p-4 space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Customer Review
            </p>

            {/* Compact rating */}
            <div className="space-y-1">
              <StarRow rating={feedback.rating} size="sm" />
              <p className="text-xs text-muted-foreground">{feedback.rating ?? '—'} / 5</p>
            </div>

            {/* Case status */}
            {relatedCase && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">
                  Case Status
                </p>
                <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[relatedCase.status]}`}>
                  {STATUS_LABELS[relatedCase.status]}
                </span>
              </div>
            )}

            {/* Review status */}
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">
                Review Status
              </p>
              {!feedback.ml_reviewed && !feedback.th_reviewed && (
                <span className="text-xs text-amber-600 font-medium">Pending review</span>
              )}
              {feedback.ml_reviewed && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Module Lead reviewed
                </span>
              )}
              {feedback.th_reviewed && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Technical Head reviewed
                </span>
              )}
            </div>

            {/* Mark as Reviewed action — shown only for the role that hasn't reviewed yet */}
            {canReview && scope.role === 'module_lead' && !feedback.ml_reviewed && (
              <Button
                className="w-full"
                size="sm"
                onClick={() => reviewMutation.mutate()}
                disabled={reviewMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                {reviewMutation.isPending ? 'Saving…' : 'Mark Reviewed'}
              </Button>
            )}
            {canReview && scope.role === 'technical_head' && !feedback.th_reviewed && (
              <Button
                className="w-full"
                size="sm"
                onClick={() => reviewMutation.mutate()}
                disabled={reviewMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                {reviewMutation.isPending ? 'Saving…' : 'Mark Reviewed'}
              </Button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
