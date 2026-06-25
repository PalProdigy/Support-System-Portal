'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { cn, formatDateTime, formatDate, slaRemainingMs, formatDuration, CLIENT_STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/utils'
import {
  MessageSquare, Clock, AlertCircle, CheckCircle2, UserCheck,
  Send, Paperclip, Download, RefreshCw, Star,
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
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [feedbackDone, setFeedbackDone] = useState(false)
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

  const solution: Solution | undefined = solutions?.find((s) => s.id === caseData?.solution_id)
  const client: Client | undefined = clients?.[0]

  const timeline = buildTimeline(logs ?? [], comments ?? [], attachments ?? [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [timeline.length])

  const submitFeedbackMutation = useMutation({
    mutationFn: () => {
      const clientId = client?.id
      if (!clientId) throw new Error('Client record not found')
      return dp.submitFeedback({
        case_id: caseId,
        client_id: clientId,
        feedback_text: feedbackText.trim(),
        rating: feedbackRating > 0 ? feedbackRating : undefined,
        lead_reviewed: false,
      }, scope)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['case', caseId] })
      qc.invalidateQueries({ queryKey: ['cases'] })
      setFeedbackDone(true)
      toast({ title: 'Feedback submitted — thank you!', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to submit feedback', variant: 'destructive' }),
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
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">Your response is needed. Reply below to continue.</span>
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
        <div className="relative pl-6 space-y-0">
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

      {/* Feedback form — shown when case is resolved and feedback not yet submitted */}
      {caseData.status === 'resolved' && !feedbackDone && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-semibold text-foreground">Case Resolved — Share Your Feedback</p>
          </div>
          <p className="text-xs text-muted-foreground">Your feedback helps us close this case and improve our service.</p>

          {/* Star rating */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setFeedbackRating(feedbackRating === n ? 0 : n)}
                className="transition-transform hover:scale-110"
              >
                <Star className={cn('h-6 w-6', n <= feedbackRating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30 hover:text-amber-300')} />
              </button>
            ))}
            {feedbackRating > 0 && <span className="text-xs text-muted-foreground ml-1">{feedbackRating}/5</span>}
          </div>

          <Textarea
            rows={3}
            placeholder="How was your experience? Any comments or suggestions? (optional)"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => submitFeedbackMutation.mutate()}
              disabled={submitFeedbackMutation.isPending || feedbackText.trim().length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send className="h-3.5 w-3.5" />
              {submitFeedbackMutation.isPending ? 'Submitting…' : 'Submit Feedback'}
            </Button>
          </div>
        </div>
      )}

      {(feedbackDone || caseData.status === 'pending_closure') && (
        <div className="rounded-xl border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 inline mr-1.5" />
          Feedback submitted — awaiting final closure review by our team.
        </div>
      )}
    </div>
  )
}
