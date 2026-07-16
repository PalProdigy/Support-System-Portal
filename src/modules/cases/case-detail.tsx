'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { PriorityChip } from '@/components/shared/priority-chip'
import { StatusBadge } from '@/components/shared/status-badge'
import { SLACountdown } from '@/components/shared/sla-countdown'
import { CaseProgressTimeline, SLAProgress } from '@/components/shared/case-progress-timeline'
import { UserAvatar } from '@/components/shared/user-avatar'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { CaseAttachments } from '@/components/shared/case-attachments'
import { SubCasesSection } from '@/modules/cases/sub-cases-section'
import { ResolveCaseDialog } from '@/modules/cases/resolve-case-dialog'
import { RequestClientInfoDialog } from '@/modules/cases/request-client-info-dialog'
import { UpdateProgressDialog } from '@/modules/cases/update-progress-dialog'
import { EngineerChangePanel } from '@/modules/cases/engineer-change-panel'
import { toast } from '@/hooks/use-toast'
import { canAccess, ROLE_LABELS } from '@/lib/rbac'
import { formatDateTime, formatDuration, PRIORITY_LABELS } from '@/lib/utils'
import { ArrowLeft, Send, Lock, AlertTriangle, Star, CheckCircle2, Users, Clock, Calendar, Plus, X, Reply, RotateCcw, UserCog, Activity, HelpCircle, PlayCircle, CheckSquare, ArrowRightLeft, Flag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { CaseStatus, CaseComment, Feedback, User, Priority } from '@/types'

// Cap how deep replies keep indenting so very deep threads don't run off-screen.
const MAX_INDENT_DEPTH = 4

// Recursive comment node: renders a comment, an inline reply box, and its nested
// replies (threaded by parent_id). A reply is just a comment with a parent.
function CommentNode({
  comment, allComments, usersMap, depth, canReply, onReply, busyReply,
}: {
  comment: CaseComment
  allComments: CaseComment[]
  usersMap: Record<string, User>
  depth: number
  canReply: boolean
  onReply: (parentId: string, body: string) => void
  busyReply: boolean
}) {
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')

  const author = usersMap[comment.author_id]
  const isClient = author?.role === 'client'
  const children = allComments.filter((c) => (c.parent_id ?? null) === comment.id)

  function submit() {
    const body = replyText.trim()
    if (!body) return
    onReply(comment.id, body)
    setReplyText('')
    setShowReply(false)
  }

  return (
    <div className="space-y-2">
      <div
        className={`rounded-xl border p-4 ${
          comment.is_internal
            ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
            : isClient
              ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
              : 'bg-card'
        }`}
      >
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <UserAvatar 
            name={author?.name ?? '?'} 
            avatarUrl={author?.avatar}
            userId={author?.id}
            size="sm" 
            border={false}
            shadow={false}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight">{author?.name ?? 'Unknown'}</p>
            {author?.role && (
              <p className="text-[10px] text-muted-foreground leading-tight">
                {ROLE_LABELS[author.role] ?? author.role}
              </p>
            )}
          </div>
          {comment.is_internal && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-full">
              <Lock className="h-2.5 w-2.5" /> Internal
            </span>
          )}
          {isClient && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded-full">
              Client
            </span>
          )}
          <span className="text-xs text-muted-foreground shrink-0">{formatDateTime(comment.created_at)}</span>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap">{comment.body}</p>

        {canReply && (
          <div className="mt-2 -ml-2">
            <Button variant="ghost" size="sm" className="gap-1 px-2 h-7" onClick={() => setShowReply((v) => !v)}>
              <Reply className="h-3 w-3" /> Reply
            </Button>
          </div>
        )}

        {showReply && (
          <div className="flex items-end gap-2 mt-2">
            <Textarea
              rows={2}
              placeholder={`Reply to ${author?.name ?? 'comment'}...`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="flex-1"
            />
            <Button size="sm" disabled={busyReply || !replyText.trim()} onClick={submit}>
              <Send className="h-3 w-3" /> Reply
            </Button>
          </div>
        )}
      </div>

      {children.length > 0 && (
        <div className={depth < MAX_INDENT_DEPTH ? 'ml-4 border-l pl-3 space-y-2' : 'pl-1 space-y-2'}>
          {children.map((child) => (
            <CommentNode
              key={child.id}
              comment={child}
              allComments={allComments}
              usersMap={usersMap}
              depth={depth + 1}
              canReply={canReply}
              onReply={onReply}
              busyReply={busyReply}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CaseDetail({ caseId }: { caseId: string }) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const [commentBody, setCommentBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [resolveOpen, setResolveOpen] = useState(false)
  const [clientInfoOpen, setClientInfoOpen] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)

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

  const { data: changeRequests } = useQuery({
    queryKey: ['engineer-change-requests', caseId],
    queryFn: () => dp.listEngineerChangeRequests(caseId),
    enabled: !!case_,
  })

  const { data: parentCase } = useQuery({
    queryKey: ['case', case_?.parent_case_id],
    queryFn: () => dp.getCase(case_!.parent_case_id!, scope),
    enabled: !!case_?.parent_case_id,
  })

  // Reopen lineage: if this case was created by reopening a previously-closed
  // case, load that original case (and its RCA) so its old data can be shown.
  // Genuinely-new cases have no reopened_from_case_id, so nothing is fetched.
  const { data: previousCase } = useQuery({
    queryKey: ['case', 'reopened-from', case_?.reopened_from_case_id],
    queryFn: () => dp.getCase(case_!.reopened_from_case_id!, scope),
    enabled: !!case_?.reopened_from_case_id,
  })
  const { data: previousRCA } = useQuery({
    queryKey: ['rca', case_?.reopened_from_case_id],
    queryFn: () => dp.getRCA(case_!.reopened_from_case_id!),
    enabled: !!case_?.reopened_from_case_id,
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
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['case', caseId] })
      qc.invalidateQueries({ queryKey: ['cases'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      // Reopening a closed case spawns a new linked case — jump to it.
      if (updated && updated.id !== caseId) {
        toast({ title: 'Case reopened as a new case', description: updated.reference_no, variant: 'success' })
        router.push(`/cases/${updated.id}`)
        return
      }
      toast({ title: 'Status updated', variant: 'success' })
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  const acceptApprovalMutation = useMutation({
    mutationFn: () => dp.acceptCaseApproval(caseId, scope),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['case', caseId] })
      qc.invalidateQueries({ queryKey: ['cases'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast({ title: 'Case accepted', variant: 'success' })
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  const addCommentMutation = useMutation({
    mutationFn: (vars: { body: string; parentId: string | null; isInternal: boolean }) =>
      dp.addComment(
        { case_id: caseId, author_id: session.userId, body: vars.body, is_internal: vars.isInternal, parent_id: vars.parentId },
        scope,
      ),
    onSuccess: (_data, vars) => {
      if (vars.parentId === null) setCommentBody('')
      refetchComments()
      toast({ title: vars.parentId ? 'Reply added' : vars.isInternal ? 'Internal note added' : 'Comment added', variant: 'success' })
    },
    onError: (err) => toast({ title: String(err), variant: 'destructive' }),
  })

  if (isLoading) return null
  if (error || !case_) return <ErrorState message="Case not found or access denied." onRetry={refetch} />

  const client = clientsMap[case_.client_id]
  const assignee = case_.assignee_id ? usersMap[case_.assignee_id] : null
  const solution = solutionsMap[case_.solution_id]
  const isSubCase = !!case_.parent_case_id
  const approvalStatus = case_.approval_status
  const approver = case_.approval_user_id ? usersMap[case_.approval_user_id] : undefined
  const canRespondApproval = !!approvalStatus && approvalStatus !== 'accepted' &&
    (session.userId === case_.approval_user_id || session.role === 'technical_head')
  const canChangeStatus = canAccess(scope, 'change_status', 'case')
  const canComment = canAccess(scope, 'create', 'comment')
  const canInternalNote = canAccess(scope, 'create', 'internal_comment')

  // ── Role-based workflow flags (spec Button Visibility) ──────────────────────
  const isLead = session.role === 'team_lead' || session.role === 'technical_head'
  const canAssign = canAccess(scope, 'assign', 'case')
  const canResolve = canAccess(scope, 'resolve', 'case')
  const canEscalate = canAccess(scope, 'escalate', 'case')
  const pendingChange = (changeRequests ?? []).find((r) => r.status === 'pending')
  const eligibleEngineers = (users ?? []).filter(
    (u) => ['support_engineer', 'team_lead'].includes(u.role) && u.is_active
  )

  // Direct-mutation helper mirroring the side-panel pattern (assign/priority/team).
  const patchCase = (patch: Partial<typeof case_>, successMsg: string) => {
    dp.updateCase(caseId, patch, scope)
      .then(() => {
        qc.invalidateQueries({ queryKey: ['case', caseId] })
        qc.invalidateQueries({ queryKey: ['cases'] })
        toast({ title: successMsg, variant: 'success' })
      })
      .catch((e: unknown) => toast({ title: String(e), variant: 'destructive' }))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back — a sub task returns to its parent case; otherwise browser back */}
      {isSubCase ? (
        <Button variant="ghost" size="sm" onClick={() => router.push(`/cases/${case_.parent_case_id}`)}>
          <ArrowLeft className="h-4 w-4" /> Back to Case
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      )}

      {/* Header */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-start gap-3 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground mt-1">{case_.reference_no}</span>
          {isSubCase && (
            <button
              onClick={() => router.push(`/cases/${case_.parent_case_id}`)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-0.5"
            >
              <ArrowLeft className="h-3 w-3" /> Sub task of {parentCase?.reference_no ?? 'parent case'}
            </button>
          )}
          {case_.is_escalated && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Escalated L{case_.escalation_level}
            </Badge>
          )}
          {pendingChange && (
            <Badge className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-100">
              <UserCog className="h-3 w-3" /> Engineer Change Request Pending
            </Badge>
          )}
        </div>
        <h1 className="text-xl font-bold text-foreground">{case_.title}</h1>
        {!isSubCase && (
          <div className="flex flex-wrap items-center gap-2">
            <PriorityChip priority={case_.priority} />
            <StatusBadge status={case_.status} />
            <SLACountdown createdAt={case_.created_at} dueAt={case_.sla_due_at} status={case_.status} />
          </div>
        )}
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{case_.description}</p>
        <p className="text-xs text-muted-foreground">Created {formatDateTime(case_.created_at)}</p>

        <Separator />
        <CaseAttachments caseId={caseId} canManage={case_.status !== 'closed'} />
      </div>

      {/* Reopen lineage — only rendered when this case was reopened from a
          previously-closed one. New cases have no previous data, so nothing shows. */}
      {case_.reopened_from_case_id && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <RotateCcw className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Reopened from a previous case</h2>
            {previousCase && (
              <button
                onClick={() => router.push(`/cases/${previousCase.id}`)}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View previous case <ArrowLeft className="h-3 w-3 rotate-180" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            This case carries data forward from a case that was previously closed and reopened.
          </p>

          {previousCase ? (
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">{previousCase.reference_no}</span>
                <PriorityChip priority={previousCase.priority} size="sm" />
                <StatusBadge status={previousCase.status} size="sm" />
                {previousCase.closed_at && (
                  <span className="text-xs text-muted-foreground">Closed {formatDateTime(previousCase.closed_at)}</span>
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Original title</p>
                <p className="text-sm font-medium text-foreground">{previousCase.title}</p>
              </div>
              {previousCase.description && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Original description</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{previousCase.description}</p>
                </div>
              )}
              {previousRCA && (previousRCA.root_cause || previousRCA.resolution) && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Previous resolution</p>
                  {previousRCA.root_cause && (
                    <p className="text-sm"><span className="font-medium text-foreground">Root cause:</span> <span className="text-muted-foreground">{previousRCA.root_cause}</span></p>
                  )}
                  {previousRCA.resolution && (
                    <p className="text-sm"><span className="font-medium text-foreground">Resolution:</span> <span className="text-muted-foreground">{previousRCA.resolution}</span></p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Loading previous case…</p>
          )}
        </div>
      )}

      {/* Service-routing approval banner */}
      {approvalStatus && (
        <div className={`rounded-xl border p-4 flex items-start gap-3 flex-wrap ${
          approvalStatus === 'accepted'
            ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20'
            : approvalStatus === 'escalated'
              ? 'border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-950/20'
              : 'border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20'
        }`}>
          <div className="flex-1 min-w-0 space-y-0.5">
            {approvalStatus === 'accepted' ? (
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Case accepted{approver ? ` by ${approver.name}` : ''}
              </p>
            ) : approvalStatus === 'escalated' ? (
              <>
                <p className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Escalated to Technical Head
                </p>
                <p className="text-xs text-muted-foreground">
                  No team-lead response within 30 minutes{case_.approval_escalated_at ? ` · escalated ${formatDateTime(case_.approval_escalated_at)}` : ''}
                  {approver ? ` · now with ${approver.name}` : ''}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Awaiting approval{approver ? ` from ${approver.name}` : ''}
                </p>
                {case_.approval_deadline && (
                  <p className="text-xs text-muted-foreground">Respond by {formatDateTime(case_.approval_deadline)} (30-minute window)</p>
                )}
              </>
            )}
          </div>
          {canRespondApproval && (
            <Button size="sm" disabled={acceptApprovalMutation.isPending} onClick={() => acceptApprovalMutation.mutate()}>
              <CheckCircle2 className="h-3.5 w-3.5" /> {acceptApprovalMutation.isPending ? 'Accepting…' : 'Accept Case'}
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main — Timeline + Comments */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="comments">
            <TabsList>
              {!isSubCase && <TabsTrigger value="progress">Progress</TabsTrigger>}
              <TabsTrigger value="comments">Comments ({comments?.length ?? 0})</TabsTrigger>
              {canChangeStatus && <TabsTrigger value="actions">Actions</TabsTrigger>}
            </TabsList>

            {!isSubCase && (
              <TabsContent value="progress" className="mt-4 space-y-4">
                <CaseProgressTimeline case_={case_} auditLogs={auditLogs} />
                <SLAProgress case_={case_} />
              </TabsContent>
            )}

            <TabsContent value="comments" className="mt-4 space-y-4">
              {/* Comment list (threaded) */}
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {(comments ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No comments yet.</p>
                )}
                {(comments ?? [])
                  .filter((c: CaseComment) => (c.parent_id ?? null) === null)
                  .map((c: CaseComment) => (
                    <CommentNode
                      key={c.id}
                      comment={c}
                      allComments={comments ?? []}
                      usersMap={usersMap}
                      depth={0}
                      canReply={canComment && !['closed'].includes(case_.status)}
                      onReply={(parentId, body) => addCommentMutation.mutate({ body, parentId, isInternal: false })}
                      busyReply={addCommentMutation.isPending}
                    />
                  ))}
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
                      onClick={() => addCommentMutation.mutate({ body: commentBody, parentId: null, isInternal })}
                    >
                      <Send className="h-3.5 w-3.5" />
                      {addCommentMutation.isPending ? 'Posting...' : 'Post'}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {canChangeStatus && (
              <TabsContent value="actions" className="mt-4 space-y-4">
                {/* Engineer Change Request — TL/TH decision */}
                {pendingChange && isLead && (
                  <EngineerChangePanel request={pendingChange} caseId={caseId} usersMap={usersMap} engineers={eligibleEngineers} />
                )}

                <div className="rounded-xl border bg-card p-4 space-y-4">
                  <h3 className="text-sm font-semibold">Actions</h3>

                  {/* NEW → Triaged (Team Lead / Technical Head) */}
                  {case_.status === 'new' && isLead && (
                    <Button size="sm" disabled={updateStatusMutation.isPending} onClick={() => updateStatusMutation.mutate('triaged')}>
                      <Flag className="h-3.5 w-3.5" /> Mark as Triaged
                    </Button>
                  )}

                  {/* TRIAGED → Assign Engineer / Change Priority / Transfer Department */}
                  {case_.status === 'triaged' && (isLead || canAssign) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Assign Engineer</Label>
                        <Select
                          value={case_.assignee_id ?? ''}
                          onValueChange={(uid) => {
                            dp.assignCase(caseId, uid, scope).then(() => {
                              qc.invalidateQueries({ queryKey: ['case', caseId] })
                              qc.invalidateQueries({ queryKey: ['cases'] })
                              qc.invalidateQueries({ queryKey: ['notifications'] })
                              toast({ title: 'Engineer assigned', variant: 'success' })
                            }).catch((e: unknown) => toast({ title: String(e), variant: 'destructive' }))
                          }}
                        >
                          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select engineer…" /></SelectTrigger>
                          <SelectContent>
                            {eligibleEngineers.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Change Priority</Label>
                        <Select value={case_.priority} onValueChange={(v) => patchCase({ priority: v as Priority }, 'Priority updated')}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.entries(PRIORITY_LABELS) as [Priority, string][]).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Transfer Department</Label>
                        <Select value={case_.team_id ?? ''} onValueChange={(v) => patchCase({ team_id: v }, 'Case transferred')}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select team…" /></SelectTrigger>
                          <SelectContent>
                            {(teams ?? []).map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* ASSIGNED → Start Working (Support Engineer) */}
                  {case_.status === 'assigned' && (
                    <Button size="sm" disabled={updateStatusMutation.isPending} onClick={() => updateStatusMutation.mutate('in_progress')}>
                      <PlayCircle className="h-3.5 w-3.5" /> Start Working
                    </Button>
                  )}

                  {/* IN PROGRESS → Update Progress / Request Client Info / Mark Resolved */}
                  {(case_.status === 'in_progress' || case_.status === 'escalated') && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setProgressOpen(true)}>
                        <Activity className="h-3.5 w-3.5" /> Update Progress
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setClientInfoOpen(true)}>
                        <HelpCircle className="h-3.5 w-3.5" /> Request Client Information
                      </Button>
                      {canResolve && (
                        <Button size="sm" onClick={() => setResolveOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          <CheckSquare className="h-3.5 w-3.5" /> Mark Resolved
                        </Button>
                      )}
                      {canEscalate && case_.status !== 'escalated' && (
                        <Button size="sm" variant="outline" disabled={updateStatusMutation.isPending}
                          onClick={() => updateStatusMutation.mutate('escalated')}
                          className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30">
                          <ArrowRightLeft className="h-3.5 w-3.5" /> Escalate
                        </Button>
                      )}
                    </div>
                  )}

                  {/* PENDING CLIENT → waiting */}
                  {case_.status === 'pending_client' && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-4 w-4" /> Waiting for the client to respond. The case returns to In Progress automatically once they reply.
                      </p>
                      <Button size="sm" variant="outline" onClick={() => setProgressOpen(true)}>
                        <Activity className="h-3.5 w-3.5" /> Update Progress
                      </Button>
                    </div>
                  )}

                  {/* RESOLVED → awaiting client confirmation */}
                  {case_.status === 'resolved' && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Resolved — awaiting client confirmation. The client will confirm the solution (closing the case) or reopen it.
                      </p>
                      {canAccess(scope, 'reopen', 'case') && (
                        <Button size="sm" variant="outline" disabled={updateStatusMutation.isPending} onClick={() => updateStatusMutation.mutate('in_progress')}>
                          <RotateCcw className="h-3.5 w-3.5" /> Reopen (send back to engineer)
                        </Button>
                      )}
                    </div>
                  )}

                  {/* CLOSED → read only */}
                  {case_.status === 'closed' && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Lock className="h-4 w-4" /> This case is closed. No further actions are available.
                    </p>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>

          {/* Sub tasks (not shown on a sub task itself) */}
          {!isSubCase && <SubCasesSection parentCase={case_} />}
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
                    (u) => ['support_engineer', 'team_lead'].includes(u.role) && u.is_active
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

          {/* Client Feedback — hidden for sub tasks */}
          {!isSubCase && (
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
                  {feedback.ml_reviewed && (
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
          )}

          {/* Timeline (time tracker) — hidden for sub tasks */}
          {!isSubCase && (() => {
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

      {/* Workflow action dialogs */}
      <ResolveCaseDialog caseId={caseId} open={resolveOpen} onOpenChange={setResolveOpen} />
      <RequestClientInfoDialog caseId={caseId} open={clientInfoOpen} onOpenChange={setClientInfoOpen} />
      <UpdateProgressDialog caseId={caseId} open={progressOpen} onOpenChange={setProgressOpen} />
    </div>
  )
}
