'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { QuestionRatingRow } from '@/components/shared/question-rating-row'
import { RatingGauge } from '@/components/shared/rating-gauge'
import { toast } from '@/hooks/use-toast'
import { cn, formatDateTime, formatDate, slaRemainingMs, formatDuration, CLIENT_STATUS_LABELS, CLIENT_INFO_REASON_LABELS, STATUS_COLORS, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/utils'
import { FEEDBACK_QUESTIONS, computeOverallRating } from '@/lib/feedback-questions'
import {
  MessageSquare, Clock, AlertCircle, CheckCircle2, UserCheck,
  Send, Paperclip, Download, RefreshCw, UserCog, RotateCcw, ThumbsUp,
} from 'lucide-react'
import type { AuditLog, CaseComment, Attachment, Solution, Client } from '@/types'

interface TimelineEvent {
  id: string
  ts: string
  type: 'created' | 'status_change' | 'comment' | 'attachment'
  data: {
    before?: { status?: string }
    after?: { status?: string; title?: string; reference_no?: string }
    comment?: CaseComment
    attachment?: Attachment
  }
}

function buildTimeline(logs: AuditLog[], comments: CaseComment[], attachments: Attachment[]): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const log of logs) {
    if (log.action === 'create' && log.entity_type === 'case') {
      events.push({ id: log.id, ts: log.created_at, type: 'created', data: { after: log.after as TimelineEvent['data']['after'] } })
    } else if (log.action === 'status_change' && log.entity_type === 'case') {
      events.push({ id: log.id, ts: log.created_at, type: 'status_change', data: { before: log.before as TimelineEvent['data']['before'], after: log.after as TimelineEvent['data']['after'] } })
    }
  }

  for (const comment of comments) {
    events.push({ id: `comment-${comment.id}`, ts: comment.created_at, type: 'comment', data: { comment } })
  }

  for (const att of attachments) {
    events.push({ id: `att-${att.id}`, ts: att.created_at, type: 'attachment', data: { attachment: att } })
  }

  return events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
}

function StatusDot({ status }: { status?: string }) {
  if (!status) return null
  const cls = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? 'bg-muted text-muted-foreground'
  const label = CLIENT_STATUS_LABELS[status as keyof typeof CLIENT_STATUS_LABELS] ?? status
  return <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cls)}>{label}</span>
}

interface Props {
  caseId: string
}

export function CaseTimeline({ caseId }: Props) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [reply, setReply] = useState('')
  const [feedbackText, setFeedbackText] = useState('')
  const [questionRatings, setQuestionRatings] = useState<Record<string, number>>({})
  const [feedbackDone, setFeedbackDone] = useState(false)
  // Resolved-state client choices
  const [showConfirmForm, setShowConfirmForm] = useState(false)
  const [showReopenForm, setShowReopenForm] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  // Engineer change request
  const [showChangeForm, setShowChangeForm] = useState(false)
  const [changeReason, setChangeReason] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: caseData, isLoading: loadingCase } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => dp.getCase(caseId, scope),
    refetchInterval: 30_000,
  })

  const { data: logs } = useQuery({
    queryKey: ['audit-logs', caseId],
    queryFn: () => dp.listAuditLogs({ entity_type: 'case', entity_id: caseId }),
  })

  const { data: comments, isLoading: loadingComments } = useQuery({
    queryKey: ['comments', caseId],
    queryFn: () => dp.listComments(caseId, scope),
  })

  const { data: attachments } = useQuery({
    queryKey: ['attachments', caseId],
    queryFn: () => dp.listAttachments(caseId),
  })

  const { data: solutions } = useQuery({
    queryKey: ['solutions'],
    queryFn: () => dp.listSolutions(),
  })

  const { data: clients } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
  })

  const { data: changeRequests } = useQuery({
    queryKey: ['engineer-change-requests', caseId],
    queryFn: () => dp.listEngineerChangeRequests(caseId),
  })
  const pendingChange = (changeRequests ?? []).find((r) => r.status === 'pending')

  const solution: Solution | undefined = solutions?.find((s) => s.id === caseData?.solution_id)
  const client: Client | undefined = clients?.[0]

  const timeline = buildTimeline(logs ?? [], comments ?? [], attachments ?? [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [timeline.length])

  const invalidateCase = () => {
    qc.invalidateQueries({ queryKey: ['case', caseId] })
    qc.invalidateQueries({ queryKey: ['cases'] })
    qc.invalidateQueries({ queryKey: ['audit-logs', caseId] })
    qc.invalidateQueries({ queryKey: ['comments', caseId] })
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  const answeredCount = FEEDBACK_QUESTIONS.filter((q) => (questionRatings[q.key] ?? 0) > 0).length
  const allQuestionsAnswered = answeredCount === FEEDBACK_QUESTIONS.length
  const overallRating = computeOverallRating(questionRatings)

  // Confirm Solution — mandatory rating + feedback, closes the case directly.
  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!allQuestionsAnswered) throw new Error('Please rate every question to confirm and close the case')
      return dp.confirmSolution(caseId, { rating: overallRating, feedback_text: feedbackText.trim(), question_ratings: questionRatings }, scope)
    },
    onSuccess: () => {
      invalidateCase()
      setFeedbackDone(true)
      setShowConfirmForm(false)
      toast({ title: 'Thank you! Your case is now closed.', variant: 'success' })
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  // Reopen — client believes the issue is not solved; back to In Progress.
  const reopenMutation = useMutation({
    mutationFn: () => dp.clientReopenCase(caseId, reopenReason.trim(), scope),
    onSuccess: () => {
      invalidateCase()
      setShowReopenForm(false)
      setReopenReason('')
      toast({ title: 'Case reopened — our team will continue working on it.', variant: 'success' })
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  // Request Engineer Change — does not change status; awaits TL/TH decision.
  const requestChangeMutation = useMutation({
    mutationFn: () => dp.requestEngineerChange(caseId, changeReason.trim(), scope),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engineer-change-requests', caseId] })
      invalidateCase()
      setShowChangeForm(false)
      setChangeReason('')
      toast({ title: 'Engineer change requested — pending team review.', variant: 'success' })
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  const addReplyMutation = useMutation({
    mutationFn: () => dp.addComment({
      case_id: caseId,
      author_id: session.userId,
      body: reply.trim(),
      is_internal: false,
    }, scope),
    onSuccess: () => {
      setReply('')
      qc.invalidateQueries({ queryKey: ['comments', caseId] })
      qc.invalidateQueries({ queryKey: ['case', caseId] })
      qc.invalidateQueries({ queryKey: ['audit-logs', caseId] })
      toast({ title: 'Reply sent', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to send reply', variant: 'destructive' }),
  })

  if (loadingCase || loadingComments) return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
    </div>
  )

  if (!caseData) return <div className="text-center text-muted-foreground py-8">Case not found.</div>

  const remaining = slaRemainingMs(caseData.sla_due_at)
  const slaBreached = remaining < 0
  const awaitingMe = caseData.status === 'pending_client'
  const canReply = !['closed', 'resolved', 'pending_closure'].includes(caseData.status)

  return (
    <div className="space-y-6">
      {/* Case header */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground">{caseData.reference_no}</span>
              <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', PRIORITY_COLORS[caseData.priority])}>
                {PRIORITY_LABELS[caseData.priority]}
              </span>
            </div>
            <h1 className="text-xl font-bold text-foreground">{caseData.title}</h1>
            <p className="text-sm text-muted-foreground">{caseData.description}</p>
          </div>
          <StatusDot status={caseData.status} />
        </div>

        {awaitingMe && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm text-amber-700 dark:text-amber-300 space-y-1">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-medium">
                {caseData.pending_client_reason
                  ? `Action needed: ${CLIENT_INFO_REASON_LABELS[caseData.pending_client_reason]}`
                  : 'Your response is needed. Reply below to continue.'}
              </span>
            </div>
            {caseData.pending_client_message && (
              <p className="text-xs text-amber-700/90 dark:text-amber-300/90 pl-6">{caseData.pending_client_message}</p>
            )}
          </div>
        )}

        {pendingChange && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            <UserCog className="h-4 w-4 shrink-0" />
            <span className="font-medium">Engineer change request pending — our team is reviewing it.</span>
          </div>
        )}

        {/* SLA countdown */}
        <div className={cn(
          'flex items-center gap-2 text-sm font-medium',
          slaBreached ? 'text-red-600 dark:text-red-400' : remaining < 4 * 3600 * 1000 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
        )}>
          <Clock className="h-4 w-4" />
          {slaBreached
            ? `SLA breached by ${formatDuration(Math.abs(remaining))}`
            : `SLA due in ${formatDuration(remaining)}`}
          <span className="font-normal text-xs text-muted-foreground ml-1">({formatDate(caseData.sla_due_at)})</span>
        </div>
      </div>

      {/* Info panels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Client info */}
        {client && (
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Account</p>
            <p className="font-semibold text-sm">{client.company_name}</p>
            <p className="text-sm text-muted-foreground">{client.contact_person}</p>
            <p className="text-sm text-muted-foreground">{client.phone}</p>
          </div>
        )}
        {/* Solution info */}
        {solution && (
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Solution</p>
            <p className="font-semibold text-sm">{solution.name}</p>
            <p className="text-sm text-muted-foreground line-clamp-2">{solution.description}</p>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" /> Case Timeline
        </p>
        <div className="relative pl-6 space-y-0 max-h-[60vh] overflow-y-auto pr-1">
          {/* Vertical line */}
          <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

          {timeline.map((event, idx) => (
            <div key={event.id} className="relative flex gap-3 pb-4">
              {/* Dot */}
              <div className={cn(
                'absolute -left-[3px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background shrink-0 z-10',
                event.type === 'created' ? 'bg-primary text-primary-foreground' :
                event.type === 'status_change' ? 'bg-muted' :
                event.type === 'comment' ? 'bg-blue-500 text-white' :
                'bg-slate-200 dark:bg-slate-700'
              )}>
                {event.type === 'created' && <CheckCircle2 className="h-2.5 w-2.5" />}
                {event.type === 'status_change' && <UserCheck className="h-2.5 w-2.5 text-muted-foreground" />}
                {event.type === 'comment' && <MessageSquare className="h-2.5 w-2.5" />}
                {event.type === 'attachment' && <Paperclip className="h-2.5 w-2.5 text-muted-foreground" />}
              </div>

              {/* Content */}
              <div className={cn('flex-1 min-w-0 ml-2', idx < timeline.length - 1 && '')}>
                {event.type === 'created' && (
                  <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2">
                    <p className="text-xs font-medium text-primary">Case submitted</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(event.ts)}</p>
                  </div>
                )}

                {event.type === 'status_change' && (
                  <div className="rounded-lg bg-muted/40 px-3 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                      <span className="text-muted-foreground">Status changed:</span>
                      {event.data.before?.status && <StatusDot status={event.data.before.status} />}
                      <span className="text-muted-foreground">→</span>
                      {event.data.after?.status && <StatusDot status={event.data.after.status} />}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(event.ts)}</p>
                  </div>
                )}

                {event.type === 'comment' && event.data.comment && (
                  <div className={cn(
                    'rounded-lg border px-3 py-2.5 space-y-1.5',
                    event.data.comment.author_id === session.userId
                      ? 'bg-primary/5 border-primary/20 ml-4'
                      : 'bg-card border-border'
                  )}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {event.data.comment.author_id === session.userId ? 'You' : 'Support Team'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{formatDateTime(event.ts)}</span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{event.data.comment.body}</p>
                  </div>
                )}

                {event.type === 'attachment' && event.data.attachment && (
                  <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 flex items-center gap-2">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground flex-1 truncate">{event.data.attachment.file_name}</span>
                    <a
                      href={event.data.attachment.file_url}
                      className="text-primary hover:text-primary/80 transition-colors"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Reply box */}
      {canReply ? (
        <div className={cn(
          'rounded-xl border bg-card p-4 space-y-3',
          awaitingMe && 'border-amber-300 dark:border-amber-600 ring-1 ring-amber-200 dark:ring-amber-700'
        )}>
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {awaitingMe ? 'Reply to continue this case' : 'Add a comment'}
          </p>
          <Textarea
            rows={3}
            placeholder={awaitingMe ? 'Provide the requested information…' : 'Type your message…'}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => addReplyMutation.mutate()}
              disabled={reply.trim().length < 2 || addReplyMutation.isPending}
            >
              <Send className="h-3.5 w-3.5" />
              {addReplyMutation.isPending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          This case is {CLIENT_STATUS_LABELS[caseData.status].toLowerCase()} — no further replies needed.
        </div>
      )}

      {/* Request Engineer Change — available while work is in progress */}
      {caseData.status === 'in_progress' && !pendingChange && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          {!showChangeForm ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserCog className="h-4 w-4" />
                Not satisfied with the assigned engineer?
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowChangeForm(true)}>
                <UserCog className="h-3.5 w-3.5" /> Request Engineer Change
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Request a different engineer</p>
              <Textarea
                rows={3}
                placeholder="Please tell us why you'd like a different engineer…"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setShowChangeForm(false); setChangeReason('') }}>Cancel</Button>
                <Button size="sm" disabled={changeReason.trim().length < 3 || requestChangeMutation.isPending}
                  onClick={() => requestChangeMutation.mutate()}>
                  {requestChangeMutation.isPending ? 'Submitting…' : 'Submit Request'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resolved — client confirms the solution (closes) or reopens the case */}
      {caseData.status === 'resolved' && !feedbackDone && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-semibold text-foreground">Your case has been resolved</p>
          </div>
          <p className="text-xs text-muted-foreground">
            If the issue is fixed, confirm the solution and share your feedback to close the case. If it isn&apos;t, you can reopen it.
          </p>

          {/* Choice buttons */}
          {!showConfirmForm && !showReopenForm && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setShowConfirmForm(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <ThumbsUp className="h-3.5 w-3.5" /> Confirm Solution
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowReopenForm(true)}>
                <RotateCcw className="h-3.5 w-3.5" /> Reopen Case
              </Button>
            </div>
          )}

          {/* Confirm → mandatory rating + feedback */}
          {showConfirmForm && (
            <div className="space-y-3 rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Rate your experience <span className="text-destructive">*</span></p>
                <span className="text-xs font-medium text-muted-foreground shrink-0">{answeredCount}/{FEEDBACK_QUESTIONS.length}</span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden -mt-1.5">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${(answeredCount / FEEDBACK_QUESTIONS.length) * 100}%` }}
                />
              </div>
              <div className="space-y-1.5">
                {FEEDBACK_QUESTIONS.map((q, i) => (
                  <QuestionRatingRow
                    key={q.key}
                    index={i + 1}
                    label={q.label}
                    value={questionRatings[q.key] ?? 0}
                    onChange={(v) => setQuestionRatings((r) => ({ ...r, [q.key]: v }))}
                    size="sm"
                  />
                ))}
                <div className="rounded-lg border bg-gradient-to-br from-card to-muted/20 p-3 mt-1">
                  <RatingGauge rating={overallRating} size="sm" />
                </div>
              </div>
              <Textarea
                rows={3}
                placeholder="Share any comments about the resolution (optional)…"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowConfirmForm(false)}>Back</Button>
                <Button size="sm" disabled={!allQuestionsAnswered || confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {confirmMutation.isPending ? 'Closing…' : 'Submit Feedback & Close Case'}
                </Button>
              </div>
            </div>
          )}

          {/* Reopen → reason */}
          {showReopenForm && (
            <div className="space-y-2 rounded-lg border bg-card p-3">
              <p className="text-sm font-medium text-foreground">Why are you reopening this case? <span className="text-destructive">*</span></p>
              <Textarea
                rows={3}
                placeholder="Describe what is still not working…"
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setShowReopenForm(false); setReopenReason('') }}>Back</Button>
                <Button size="sm" disabled={reopenReason.trim().length < 3 || reopenMutation.isPending}
                  onClick={() => reopenMutation.mutate()}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  {reopenMutation.isPending ? 'Reopening…' : 'Reopen Case'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {(feedbackDone || caseData.status === 'closed') && (
        <div className="rounded-xl border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 inline mr-1.5" />
          This case is closed. Thank you for your feedback.
        </div>
      )}
    </div>
  )
}
