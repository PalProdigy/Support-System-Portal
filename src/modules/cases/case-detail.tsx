'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { PriorityChip } from '@/components/shared/priority-chip'
import { StatusBadge } from '@/components/shared/status-badge'
import { SLACountdown } from '@/components/shared/sla-countdown'
import { UserAvatar } from '@/components/shared/user-avatar'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { canAccess, ROLE_LABELS } from '@/lib/rbac'
import { formatDateTime, formatDuration, STATUS_TRANSITIONS, STATUS_LABELS } from '@/lib/utils'
import { ArrowLeft, Send, Lock, AlertTriangle, Star, CheckCircle2, Users, Clock, Calendar, Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { CaseStatus, CaseComment, Feedback } from '@/types'

export default function CaseDetail({ caseId }: { caseId: string }) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const [commentBody, setCommentBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)

  const { data: case_, isLoading, error, refetch } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => dp.getCase(caseId, scope),
  })

  const { data: clients } = useQuery({ queryKey: ['clients', session.userId], queryFn: () => dp.listClients(scope) })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: solutions } = useQuery({ queryKey: ['solutions'], queryFn: () => dp.listSolutions() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
  const { data: comments, refetch: refetchComments } = useQuery({
    queryKey: ['comments', caseId],
    queryFn: () => dp.listComments(caseId, scope),
    enabled: !!case_,
  })

  const { data: allFeedback } = useQuery({
    queryKey: ['feedback'],
    queryFn: () => dp.listFeedback(scope),
    enabled: !!case_,
  })

  const { data: auditLogs } = useQuery({
    queryKey: ['audit-logs-case', caseId],
    queryFn: () => dp.listAuditLogs({ entity_type: 'case', entity_id: caseId }),
    enabled: !!case_,
  })

  const feedback: Feedback | undefined = (allFeedback ?? []).find((f: Feedback) => f.case_id === caseId)

  const clientsMap  = Object.fromEntries((clients  ?? []).map((c) => [c.id, c]))
  const usersMap    = Object.fromEntries((users    ?? []).map((u) => [u.id, u]))
  const solutionsMap = Object.fromEntries((solutions ?? []).map((s) => [s.id, s]))
  const teamsMap    = Object.fromEntries((teams    ?? []).map((t) => [t.id, t]))

  // All engineers ever assigned to this case (ordered by first assignment)
  const assignedEngineers = useMemo(() => {
    const seen = new Set<string>()
    const result: Array<{ userId: string; assignedAt: string }> = []
    for (const log of (auditLogs ?? [])) {
      const uid = log.after?.assignee_id as string | undefined
      if (log.action === 'assign' && uid && !seen.has(uid)) {
        seen.add(uid)
        result.push({ userId: uid, assignedAt: log.created_at })
      }
    }
    return result
  }, [auditLogs])

  const updateStatusMutation = useMutation({
    mutationFn: async (targetStatus: CaseStatus) => {
      const current = case_?.status
      // Route to the correct lifecycle method so notifications fire correctly
      if (targetStatus === 'in_progress') {
        if (current === 'assigned') return dp.startWork(caseId, scope)
        if (current === 'closed' || current === 'pending_closure') return dp.reopenCase(caseId, scope)
        return dp.updateCase(caseId, { status: 'in_progress' }, scope)
      }
      if (targetStatus === 'pending_client') return dp.requestClientInfo(caseId, scope)
      if (targetStatus === 'resolved') return dp.resolveCase(caseId, scope)
      if (targetStatus === 'escalated') return dp.escalateCase(caseId, scope)
      if (targetStatus === 'closed') return dp.grantClosure(caseId, scope)
      return dp.updateCase(caseId, { status: targetStatus }, scope)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['case', caseId] })
      qc.invalidateQueries({ queryKey: ['cases'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast({ title: 'Status updated', variant: 'success' })
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  const addCommentMutation = useMutation({
    mutationFn: () =>
      dp.addComment({ case_id: caseId, author_id: session.userId, body: commentBody, is_internal: isInternal }, scope),
    onSuccess: () => {
      setCommentBody('')
      refetchComments()
      toast({ title: isInternal ? 'Internal note added' : 'Comment added', variant: 'success' })
    },
    onError: (err) => toast({ title: String(err), variant: 'destructive' }),
  })

  if (isLoading) return null
  if (error || !case_) return <ErrorState message="Case not found or access denied." onRetry={refetch} />

  const client = clientsMap[case_.client_id]
  const assignee = case_.assignee_id ? usersMap[case_.assignee_id] : null
  const solution = solutionsMap[case_.solution_id]
  const availableTransitions = STATUS_TRANSITIONS[case_.status] ?? []
  const canChangeStatus = canAccess(scope, 'change_status', 'case')
  const canComment = canAccess(scope, 'create', 'comment')
  const canInternalNote = canAccess(scope, 'create', 'internal_comment')

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Header */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-start gap-3 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground mt-1">{case_.reference_no}</span>
          {case_.is_escalated && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Escalated L{case_.escalation_level}
            </Badge>
          )}
        </div>
        <h1 className="text-xl font-bold text-foreground">{case_.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <PriorityChip priority={case_.priority} />
          <StatusBadge status={case_.status} />
          <SLACountdown createdAt={case_.created_at} dueAt={case_.sla_due_at} status={case_.status} />
        </div>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{case_.description}</p>
        <p className="text-xs text-muted-foreground">Created {formatDateTime(case_.created_at)}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main — Timeline + Comments */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="comments">
            <TabsList>
              <TabsTrigger value="comments">Comments ({comments?.length ?? 0})</TabsTrigger>
              {canChangeStatus && <TabsTrigger value="actions">Actions</TabsTrigger>}
            </TabsList>

            <TabsContent value="comments" className="mt-4 space-y-4">
              {/* Comment list */}
              <div className="space-y-3">
                {(comments ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No comments yet.</p>
                )}
                {(comments ?? []).map((c: CaseComment) => {
                  const author = usersMap[c.author_id]
                  const isClient = author?.role === 'client'
                  return (
                    <div
                      key={c.id}
                      className={`rounded-xl border p-4 ${
                        c.is_internal
                          ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                          : isClient
                            ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                            : 'bg-card'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <UserAvatar name={author?.name ?? '?'} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{author?.name ?? 'Unknown'}</p>
                          {author?.role && (
                            <p className="text-[10px] text-muted-foreground leading-tight">
                              {ROLE_LABELS[author.role] ?? author.role}
                            </p>
                          )}
                        </div>
                        {c.is_internal && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-full">
                            <Lock className="h-2.5 w-2.5" /> Internal
                          </span>
                        )}
                        {isClient && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded-full">
                            Client
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground shrink-0">{formatDateTime(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{c.body}</p>
                    </div>
                  )
                })}
              </div>

              {/* Add comment */}
              {canComment && !['closed'].includes(case_.status) && (
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <Textarea
                    placeholder="Write a comment..."
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    rows={3}
                  />
                  <div className="flex items-center justify-between">
                    {canInternalNote && (
                      <div className="flex items-center gap-2">
                        <Switch id="internal" checked={isInternal} onCheckedChange={setIsInternal} />
                        <Label htmlFor="internal" className="text-sm cursor-pointer">Internal note</Label>
                      </div>
                    )}
                    <Button
                      className="ml-auto"
                      size="sm"
                      disabled={!commentBody.trim() || addCommentMutation.isPending}
                      onClick={() => addCommentMutation.mutate()}
                    >
                      <Send className="h-3.5 w-3.5" />
                      {addCommentMutation.isPending ? 'Posting...' : 'Post'}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {canChangeStatus && (
              <TabsContent value="actions" className="mt-4">
                <div className="rounded-xl border bg-card p-4 space-y-4">
                  <h3 className="text-sm font-semibold">Change Status</h3>
                  {availableTransitions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No transitions available from {STATUS_LABELS[case_.status]}.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableTransitions.map((s: CaseStatus) => (
                        <Button
                          key={s}
                          variant="outline"
                          size="sm"
                          disabled={updateStatusMutation.isPending}
                          onClick={() => updateStatusMutation.mutate(s)}
                        >
                          → {STATUS_LABELS[s]}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Client */}
          {client && session.role !== 'client' && (
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Client</h3>
              <p className="text-sm font-semibold">{client.company_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{client.contact_person}</p>
              <p className="text-xs text-muted-foreground">{client.phone}</p>
            </div>
          )}

          {/* Solution */}
          {solution && (
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Solution</h3>
              <p className="text-sm font-medium">{solution.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{solution.category}</p>
            </div>
          )}

          {/* Assigned — Team + Lead + Engineers */}
          {(() => {
            const team    = case_.team_id ? teamsMap[case_.team_id] : null
            const lead    = team ? usersMap[team.lead_user_id] : null
            const isClosed = case_.status === 'closed'

            return (
              <div className="rounded-xl border bg-card p-4 space-y-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Assigned
                </h3>

                {/* Team row */}
                {team && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Team</p>
                    <p className="text-sm font-semibold text-foreground">{team.name}</p>
                  </div>
                )}

                {/* Team Lead */}
                {lead && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Team Lead</p>
                    <div className="flex items-center gap-2">
                      <UserAvatar name={lead.name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{lead.name}</p>
                        <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[lead.role] ?? lead.role}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Support Engineers */}
                {(() => {
                  const currentIds = new Set([
                    ...(case_.assignee_id ? [case_.assignee_id] : []),
                    ...(case_.co_assignee_ids ?? []),
                  ])
                  const allCurrentEngineers = [...currentIds]
                    .map((uid) => usersMap[uid])
                    .filter(Boolean)

                  const eligibleEngineers = (users ?? []).filter(
                    (u) => ['support_engineer', 'module_lead'].includes(u.role) && u.is_active
                  )
                  const unassigned = eligibleEngineers.filter((u) => !currentIds.has(u.id))

                  const removeCoAssignee = (uid: string) => {
                    const next = (case_.co_assignee_ids ?? []).filter((id) => id !== uid)
                    dp.updateCase(caseId, { co_assignee_ids: next }, scope)
                      .then(() => {
                        qc.invalidateQueries({ queryKey: ['case', caseId] })
                        toast({ title: 'Engineer removed', variant: 'success' })
                      })
                      .catch((e: unknown) => toast({ title: String(e), variant: 'destructive' }))
                  }

                  return (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Support Engineer{allCurrentEngineers.length !== 1 ? 's' : ''}
                        {allCurrentEngineers.length > 0 && ` (${allCurrentEngineers.length})`}
                      </p>

                      {/* Currently assigned engineers */}
                      {allCurrentEngineers.length > 0 ? (
                        <div className="space-y-2">
                          {allCurrentEngineers.map((eng) => {
                            const isPrimary = eng.id === case_.assignee_id
                            const isCoAssignee = (case_.co_assignee_ids ?? []).includes(eng.id)
                            return (
                              <div key={eng.id} className="flex items-center gap-2">
                                <UserAvatar name={eng.name} size="sm" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{eng.name}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {ROLE_LABELS[eng.role] ?? eng.role}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {isClosed
                                    ? <Badge variant="secondary" className="text-[10px]">{isPrimary ? 'Lead' : 'Support'}</Badge>
                                    : <Badge variant={isPrimary ? 'default' : 'secondary'} className="text-[10px]">
                                        {isPrimary ? 'Primary' : 'Co-assignee'}
                                      </Badge>
                                  }
                                  {!isClosed && isCoAssignee && canAccess(scope, 'assign', 'case') && (
                                    <button
                                      onClick={() => removeCoAssignee(eng.id)}
                                      className="h-4 w-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                      title="Remove co-assignee"
                                    >
                                      <X className="h-2.5 w-2.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Unassigned</p>
                      )}

                      {/* Assignment controls — active cases only */}
                      {!isClosed && canAccess(scope, 'assign', 'case') && (
                        <div className="space-y-1.5 pt-1">
                          {/* Primary assignee */}
                          <p className="text-[10px] text-muted-foreground">Set primary</p>
                          <Select
                            value={case_.assignee_id ?? ''}
                            onValueChange={(uid) => {
                              dp.assignCase(caseId, uid, scope).then(() => {
                                qc.invalidateQueries({ queryKey: ['case', caseId] })
                                qc.invalidateQueries({ queryKey: ['notifications'] })
                                toast({ title: 'Primary assignee updated', variant: 'success' })
                              }).catch((e: unknown) => toast({ title: String(e), variant: 'destructive' }))
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Assign primary..." />
                            </SelectTrigger>
                            <SelectContent>
                              {eligibleEngineers.map((u) => (
                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Add co-assignee */}
                          {unassigned.length > 0 && (
                            <>
                              <p className="text-[10px] text-muted-foreground">Add co-assignee</p>
                              <Select
                                value=""
                                onValueChange={(uid) => {
                                  const next = [...(case_.co_assignee_ids ?? []), uid]
                                  dp.updateCase(caseId, { co_assignee_ids: next }, scope)
                                    .then(() => {
                                      qc.invalidateQueries({ queryKey: ['case', caseId] })
                                      toast({ title: 'Co-assignee added', variant: 'success' })
                                    })
                                    .catch((e: unknown) => toast({ title: String(e), variant: 'destructive' }))
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder={
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                      <Plus className="h-3 w-3" /> Add engineer...
                                    </span>
                                  } />
                                </SelectTrigger>
                                <SelectContent>
                                  {unassigned.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          })()}

          {/* Client Feedback */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-yellow-500" /> Client Feedback
            </h3>

            {feedback ? (
              <>
                {/* Star rating */}
                {feedback.rating != null ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`h-5 w-5 ${i < feedback.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/20'}`}
                        />
                      ))}
                      <span className="text-sm font-bold ml-1">
                        {feedback.rating}
                        <span className="text-xs font-normal text-muted-foreground"> / 5</span>
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {feedback.rating >= 4 ? 'Excellent' : feedback.rating === 3 ? 'Satisfactory' : 'Needs improvement'}
                    </p>
                  </div>
                ) : (
                  <div className="flex">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className="h-5 w-5 text-muted-foreground/20" />
                    ))}
                    <span className="text-xs text-muted-foreground ml-2">No rating given</span>
                  </div>
                )}

                {/* Feedback text */}
                <blockquote className="border-l-2 border-primary/30 pl-2.5 italic text-xs leading-relaxed">
                  {feedback.feedback_text
                    ? <span className="text-muted-foreground">&ldquo;{feedback.feedback_text}&rdquo;</span>
                    : <span className="text-muted-foreground/50 not-italic">No comment provided</span>
                  }
                </blockquote>

                {/* Client + timestamp + reviewed badge */}
                <div className="flex items-center justify-between flex-wrap gap-1 border-t pt-2.5">
                  <div className="space-y-0.5">
                    {client && (
                      <p className="text-xs font-medium text-foreground">{client.company_name}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">{formatDateTime(feedback.created_at)}</p>
                  </div>
                  {feedback.lead_reviewed && (
                    <Badge variant="secondary" className="text-[10px] gap-1 h-4">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Reviewed
                    </Badge>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-3 space-y-2">
                <div className="flex justify-center gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className="h-6 w-6 text-muted-foreground/15" />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {['resolved', 'closed', 'pending_closure'].includes(case_.status)
                    ? 'Awaiting client feedback'
                    : 'Feedback available after resolution'}
                </p>
              </div>
            )}
          </div>

          {/* Timeline */}
          {(() => {
            const createdMs  = new Date(case_.created_at).getTime()
            const endMs      = case_.resolved_at
              ? new Date(case_.resolved_at).getTime()
              : Date.now()
            const durationMs = endMs - createdMs
            const daysOpen   = Math.ceil(durationMs / 86_400_000)
            const slaMs      = case_.sla_due_at ? new Date(case_.sla_due_at).getTime() : null
            const slaBreached = slaMs
              ? (case_.resolved_at
                  ? new Date(case_.resolved_at).getTime() > slaMs
                  : Date.now() > slaMs)
              : false

            return (
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Timeline</h3>

                {/* Duration + Days stat tiles */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/40 p-2.5 space-y-0.5">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" /> Duration
                    </div>
                    <p className="text-sm font-bold text-foreground">{formatDuration(durationMs)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2.5 space-y-0.5">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Calendar className="h-3 w-3" /> Days {case_.resolved_at ? 'Taken' : 'Open'}
                    </div>
                    <p className="text-sm font-bold text-foreground">{daysOpen} day{daysOpen !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                {/* Date rows */}
                <div className="space-y-2 border-t pt-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> Created
                    </span>
                    <span className="text-foreground font-medium">{formatDateTime(case_.created_at)}</span>
                  </div>

                  {slaMs && (
                    <div className="flex items-center justify-between text-xs">
                      <span className={`flex items-center gap-1.5 ${slaBreached ? 'text-red-500' : 'text-muted-foreground'}`}>
                        <AlertTriangle className="h-3 w-3" /> SLA Due
                      </span>
                      <div className="text-right">
                        <p className={`font-medium ${slaBreached ? 'text-red-500' : 'text-foreground'}`}>
                          {formatDateTime(case_.sla_due_at!)}
                        </p>
                        {slaBreached && (
                          <p className="text-[10px] text-red-500">Breached</p>
                        )}
                      </div>
                    </div>
                  )}

                  {case_.resolved_at && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-600 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3" /> Resolved
                      </span>
                      <span className="text-emerald-600 font-medium">{formatDateTime(case_.resolved_at)}</span>
                    </div>
                  )}

                  {case_.closed_at && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3" /> Closed
                      </span>
                      <span className="text-foreground font-medium">{formatDateTime(case_.closed_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
