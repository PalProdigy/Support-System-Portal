'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useRef } from 'react'
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
import { ExternalMembersCard } from '@/components/shared/external-members-card'

import { AddSubCaseDialog } from '@/modules/cases/add-sub-case-dialog'
import { ResolveCaseDialog } from '@/modules/cases/resolve-case-dialog'
import { RequestClientInfoDialog } from '@/modules/cases/request-client-info-dialog'
import { UpdateProgressDialog } from '@/modules/cases/update-progress-dialog'
import { EngineerChangePanel } from '@/modules/cases/engineer-change-panel'
import { toast } from '@/hooks/use-toast'
import { canAccess, canCreateSubCase, ROLE_LABELS } from '@/lib/rbac'
import { formatDateTime, formatDuration, PRIORITY_LABELS } from '@/lib/utils'
import { FEEDBACK_QUESTIONS } from '@/lib/feedback-questions'
import { RatingGauge } from '@/components/shared/rating-gauge'
import { ArrowLeft, Send, Lock, AlertTriangle, Star, CheckCircle2, Users, Clock, Calendar, Plus, X, Reply, RotateCcw, UserCog, Activity, HelpCircle, PlayCircle, CheckSquare, ArrowRightLeft, Flag, Paperclip, Mail, History, ChevronDown, ChevronRight, Eye, MessageCircle, XCircle } from 'lucide-react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const scope = { userId: session.userId, role: session.role }

  const [commentBody, setCommentBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [wfCommentBody, setWfCommentBody] = useState('')
  const wfTextareaRef = useRef<HTMLTextAreaElement>(null)
  const wfResizeDrag = useRef<{ startY: number; startHeight: number } | null>(null)

  // Pointer Events unify mouse + touch, so this drag handle resizes on both
  // desktop (mouse) and mobile (touch) — the native CSS `resize` handle only
  // responds to mouse drags and is inert on touch browsers.
  function handleWfResizeStart(e: React.PointerEvent<HTMLDivElement>) {
    const el = wfTextareaRef.current
    if (!el) return
    e.preventDefault()
    wfResizeDrag.current = { startY: e.clientY, startHeight: el.offsetHeight }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function handleWfResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = wfResizeDrag.current
    const el = wfTextareaRef.current
    if (!drag || !el) return
    const next = Math.min(256, Math.max(28, drag.startHeight + (e.clientY - drag.startY)))
    el.style.height = `${next}px`
  }
  function handleWfResizeEnd() {
    wfResizeDrag.current = null
  }
  const [resolveOpen, setResolveOpen] = useState(false)
  const [clientInfoOpen, setClientInfoOpen] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [wfExpanded, setWfExpanded] = useState<string | null>('fix')
  const [addOpen, setAddOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const tab = searchParams.get('tab') || 'progress'

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

  const { data: previousCase } = useQuery({
    queryKey: ['case', 'reopened-from', case_?.reopened_from_case_id],
    queryFn: () => dp.getCase(case_!.reopened_from_case_id!, scope),
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

  const claimCaseMutation = useMutation({
    mutationFn: () => dp.claimCase(caseId, scope),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['case', caseId] })
      qc.invalidateQueries({ queryKey: ['cases'] })
      qc.invalidateQueries({ queryKey: ['claimable-cases'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast({ title: 'Case assigned to you', variant: 'success' })
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

  // Uploads a file from either comment box (floating widget or workflow reply)
  // straight to the case's Attachments — mirrors CaseAttachments' own upload flow.
  const attachMutation = useMutation({
    mutationFn: (file: File) =>
      dp.addAttachment({
        case_id: caseId,
        uploaded_by: session.userId,
        file_url: URL.createObjectURL(file),
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        category: 'comment',
        size: file.size,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attachments', caseId] })
      toast({ title: 'File attached', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to attach file', variant: 'destructive' }),
  })

  function handleCommentFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    Array.from(fileList).forEach((f) => attachMutation.mutate(f))
  }

  if (isLoading) return null
  if (error || !case_) return <ErrorState message="Case not found or access denied." onRetry={refetch} />

  const client = clientsMap[case_.client_id]
  const assignee = case_.assignee_id ? usersMap[case_.assignee_id] : null
  const solution = solutionsMap[case_.solution_id]
  const isSubCase = !!case_.parent_case_id
  const showFeedbackTab = !isSubCase && ['resolved', 'closed', 'pending_closure'].includes(case_.status)
  // A brand-new, untouched case has no workflow progress or attachments/emails
  // to show yet, and definitely isn't ready to close.
  const isNewCase = case_.status === 'new'
  const effectiveTab = isNewCase && (tab === 'progress' || tab === 'related') ? 'activity' : tab
  const approvalStatus = case_.approval_status
  const approver = case_.approval_user_id ? usersMap[case_.approval_user_id] : undefined
  const canGrabCase = session.role === 'support_engineer' && !case_.assignee_id && ['new', 'triaged'].includes(case_.status)
  const canRespondApproval = !!approvalStatus && approvalStatus !== 'accepted' &&
    (session.userId === case_.approval_user_id || session.role === 'technical_head')
  const canChangeStatus = canAccess(scope, 'change_status', 'case')
  const canComment = canAccess(scope, 'create', 'comment')
  const canInternalNote = canAccess(scope, 'create', 'internal_comment')
  const canAddSubTask = canCreateSubCase(session.role)

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
    <div className="px-6 pb-6 pt-1 max-w-7xl mx-auto ">
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
      <div className=" space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-gradient-to-br from-card to-muted/30 shadow-sm p-5 space-y-4">
        <div className="flex items-start gap-3 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground mt-1">{case_.reference_no}</span>
          {case_.reopened_from_case_id && previousCase && (
            <button
              onClick={() => router.push(`/cases/${previousCase.id}`)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline mt-0.5"
            >
              <RotateCcw className="h-3 w-3" /> Follow-up to {previousCase.reference_no}
            </button>
          )}
          {isSubCase && (
            <button
              onClick={() => router.push(`/cases/${case_.parent_case_id}`)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-0.5"
            >
              <ArrowLeft className="h-3 w-3" /> Case Update of {parentCase?.reference_no ?? 'parent case'}
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
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            Created {formatDateTime(case_.created_at)}
          </span>
          {case_.updated_at && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Updated {formatDateTime(case_.updated_at)}
              </span>
            </>
          )}
        </div>
      </div>


      {/* Unassigned, new/triaged case — a support engineer can grab it themselves */}
      {canGrabCase && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/10 p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <Users className="h-4 w-4" /> This case isn&apos;t assigned yet — you can grab it.
          </p>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={claimCaseMutation.isPending}
            onClick={() => claimCaseMutation.mutate()}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> {claimCaseMutation.isPending ? 'Grabbing…' : 'Grab Case'}
          </Button>
        </div>
      )}

      {/* Service-routing approval banner — irrelevant to a support engineer who
          can just grab the case directly, so it's suppressed in that case to
          avoid contradicting the Grab Case banner above. */}
      {approvalStatus && !canGrabCase && (
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
          <Tabs value={effectiveTab} onValueChange={(v) => router.replace(`/cases/${caseId}?tab=${v}`, { scroll: false })}>
            <TabsList>
              {!isNewCase && (
                <>
                  <TabsTrigger value="progress">Progress</TabsTrigger>
                  <TabsTrigger value="related">Related</TabsTrigger>
                </>
              )}
              <TabsTrigger value="activity">Activity</TabsTrigger>
              {showFeedbackTab && <TabsTrigger value="feedback">Feedback</TabsTrigger>}
            </TabsList>

            <TabsContent value="progress" className="mt-4 space-y-4">
              {/* Sub-task workflow items */}
              {!isSubCase && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Workflow</h3>
                    {canAddSubTask && (
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setAddOpen(true)}>
                        <Plus className="h-3.5 w-3.5" /> Add Case Update
                      </Button>
                    )}
                  </div>

                  {([
                    { id: 'triage', label: 'Triage & reproduce', time: '1h 10m', done: true,
                      comments: ['Initial triage completed. Confirmed issue on all affected endpoints.'] },
                    { id: 'rca', label: 'Root-cause analysis', time: '2h 25m', done: true,
                      comments: ['Checked logs — root cause identified as kernel driver mismatch.'] },
                    { id: 'fix', label: 'Apply fix & verify', time: 'running', done: false,
                      comments: ['Re-registration script prepared. Awaiting maintenance window.'] },
                  ]).map((item) => {
                    const isActive = item.id === 'fix'
                    const isOpen = wfExpanded === item.id

                    return (
                      <div key={item.id} className={`rounded-xl border overflow-hidden transition-all ${
                        isActive
                          ? 'border-blue-400 dark:border-blue-500 bg-card shadow-[0_0_14px_-3px] shadow-blue-400/50 dark:shadow-blue-600/50'
                          : 'bg-card hover:shadow-sm'
                      }`}>
                        <button
                          onClick={() => setWfExpanded((v) => v === item.id ? null : item.id)}
                          className={`w-full flex items-center justify-between text-left p-3 hover:bg-accent/20 transition-colors`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${isActive ? 'bg-blue-500 animate-pulse' : item.done ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                            <p className="text-sm font-medium">{item.label}</p>
                            {item.done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                          </div>
                          <span className={`text-xs flex items-center gap-1 ${isActive ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>
                            <Clock className={`h-3 w-3 ${isActive ? 'animate-pulse' : ''}`} />
                            {item.time}
                            {isOpen ? <ChevronDown className="h-3.5 w-3.5 ml-1" /> : <ChevronRight className="h-3.5 w-3.5 ml-1" />}
                          </span>
                        </button>

                        {isOpen && (
                          <div className="border-t border-border px-3 pb-3 pt-2 space-y-3">
                            <div className="flex items-center gap-2">
                              <UserAvatar name="Reza Karim" size="sm" />
                              <span className="text-xs font-medium">Reza Karim</span>
                            </div>
                            <div className="space-y-2 pl-4 border-l-2 border-muted">
                              {item.comments.map((body, i) => (
                                <div key={i} className="text-xs text-muted-foreground leading-relaxed">
                                  <span className="font-medium text-foreground">Reza Karim</span>
                                  <span className="text-muted-foreground/50 ml-1">28 Jun · 14:20</span>
                                  <p className="mt-0.5">{body}</p>
                                </div>
                              ))}
                            </div>
                            {isActive && canComment && !['closed'].includes(case_.status) && (
                              <div className="flex items-end gap-1.5 pt-1 bg-muted/30 dark:bg-muted/5 rounded-lg p-1.5 ring-1 ring-border focus-within:ring-2 focus-within:ring-primary/30 transition-all">
                                <input
                                  type="file"
                                  multiple
                                  className="hidden"
                                  id="wf-comment-attach"
                                  onChange={(e) => { handleCommentFiles(e.target.files); e.target.value = '' }}
                                />
                                <label
                                  htmlFor="wf-comment-attach"
                                  className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                >
                                  <Paperclip className="h-3.5 w-3.5" />
                                </label>
                                <div className="relative flex-1">
                                  <div
                                    onPointerDown={handleWfResizeStart}
                                    onPointerMove={handleWfResizeMove}
                                    onPointerUp={handleWfResizeEnd}
                                    onPointerCancel={handleWfResizeEnd}
                                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-10 flex items-center justify-center cursor-ns-resize touch-none z-10"
                                  >
                                    <span className="h-1 w-6 rounded-full bg-muted-foreground/40" />
                                  </div>
                                  <Textarea
                                    ref={wfTextareaRef}
                                    placeholder="Reply to your engineer…"
                                    rows={1}
                                    value={wfCommentBody}
                                    onChange={(e) => setWfCommentBody(e.target.value)}
                                    className="min-h-[28px] max-h-64 w-full border-0 bg-transparent resize-none px-1 py-1.5 text-xs shadow-none focus-visible:ring-0"
                                  />
                                </div>
                                <Button
                                  size="icon"
                                  className="shrink-0 h-7 w-7 rounded-md"
                                  disabled={!wfCommentBody.trim() || addCommentMutation.isPending}
                                  onClick={() => {
                                    addCommentMutation.mutate({ body: wfCommentBody, parentId: null, isInternal: false })
                                    setWfCommentBody('')
                                  }}
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Sub-cases dialog */}
              {canAddSubTask && addOpen && <AddSubCaseDialog parentCase={case_} open={addOpen} onOpenChange={setAddOpen} />}
            </TabsContent>

            <TabsContent value="related" className="mt-4 space-y-4">
              <Tabs defaultValue="attachments">
                <TabsList>
                  <TabsTrigger value="attachments">Attachments</TabsTrigger>
                  <TabsTrigger value="emails">Emails</TabsTrigger>
                </TabsList>
                <TabsContent value="attachments" className="mt-4">
                  <div className="rounded-xl border bg-card p-4 space-y-3">
                    <CaseAttachments caseId={caseId} canManage={case_.status !== 'closed' && canAccess(scope, 'create', 'attachment')} />
                  </div>
                </TabsContent>
                <TabsContent value="emails" className="mt-4">
                  <div className="rounded-xl border bg-card overflow-hidden">
                    <div className="p-4 pb-0 flex items-center justify-between">
                      <h3 className="text-sm font-semibold flex items-center gap-1.5">
                        <Mail className="h-4 w-4 text-muted-foreground" /> Emails
                      </h3>
                      <span className="text-xs text-muted-foreground">9 items</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs mt-2">
                        <thead>
                          <tr className="border-y bg-muted/30">
                            <th className="text-left font-medium text-muted-foreground px-4 py-2.5 min-w-[200px]">Subject</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-2.5">From</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-2.5 hidden sm:table-cell">To</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Date</th>
                            <th className="text-right font-medium text-muted-foreground px-4 py-2.5 w-16">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {[
                            { subject: 'Survey from NetWitness Technical Support', from: 'nw.cx@netwitness.com', to: 'sidratul@nhqbd.com', date: '11/27/2025, 6:10 PM' },
                            { subject: 'RE: Netwitness | NHQ DISTRIBUTIONS LTD | 00519568 | S2 | 12.5.1.3 | How to Integration Delinea PAM with NetWitness', from: 'caseupdate@netwitness.com', to: 'sidratul@nhqbd.com', date: '11/27/2025, 6:07 PM' },
                            { subject: 'RE: Netwitness | NHQ DISTRIBUTIONS LTD | 00519568 | S2 | 12.5.1.3 | How to Integration Delinea PAM with NetWitness', from: 'caseupdate@netwitness.com', to: 'sidratul@nhqbd.com', date: '11/26/2025, 8:16 PM' },
                            { subject: 'RE: Netwitness | NHQ DISTRIBUTIONS LTD | 00519568 | S2 | 12.5.1.3 | How to Integration Delinea PAM with NetWitness', from: 'caseupdate@netwitness.com', to: 'sidratul@nhqbd.com', date: '11/20/2025, 1:33 AM' },
                            { subject: 'RE: Netwitness | NHQ DISTRIBUTIONS LTD | 00519568 | S2 | 12.5.1.3 | How to Integration Delinea PAM with NetWitness', from: 'sidratul@nhqbd.com', to: 'caseupdate@netwitness.com', date: '11/19/2025, 11:22 PM' },
                            { subject: 'RE: Netwitness | NHQ DISTRIBUTIONS LTD | 00519568 | S2 | 12.5.1.3 | How to Integration Delinea PAM with NetWitness', from: 'caseupdate@netwitness.com', to: 'sidratul@nhqbd.com', date: '11/19/2025, 10:02 PM' },
                            { subject: 'Welcome to NetWitness Support Portal', from: 'support@netwitness.com', to: 'sidratul@nhqbd.com', date: '11/15/2025, 9:00 AM' },
                            { subject: 'RE: License renewal for NHD-4381', from: 'licensing@netwitness.com', to: 'sidratul@nhqbd.com', date: '11/14/2025, 3:45 PM' },
                            { subject: 'RE: Netwitness | NHQ DISTRIBUTIONS LTD | 00519568 | S2 | FW log ingestion delay', from: 'caseupdate@netwitness.com', to: 'sidratul@nhqbd.com', date: '11/13/2025, 12:30 PM' },
                          ].map((email, i) => (
                            <tr key={i} className="hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-2.5">
                                <p className="font-medium text-foreground truncate max-w-[300px]">{email.subject}</p>
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground">{email.from}</td>
                              <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{email.to}</td>
                              <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{email.date}</td>
                              <td className="px-4 py-2.5 text-right">
                                <button className="h-7 w-7 rounded-md hover:bg-muted-foreground/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors mx-auto" title="View email">
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="activity" className="mt-4 space-y-4">
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-1 rounded-full bg-primary" />
                  <h3 className="text-sm font-semibold">Timeline</h3>
                </div>
                <div className="space-y-0">
                  <div className="flex gap-3.5">
                    <div className="flex flex-col items-center">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                      </div>
                      <div className="w-0.5 flex-1 bg-border min-h-[32px]" />
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-foreground">Case opened</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Raised against {solution?.name ?? 'case'}.</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-1">2d ago</p>
                    </div>
                  </div>

                  {case_.assignee_id && (
                    <div className="flex gap-3.5">
                      <div className="flex flex-col items-center">
                        <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="w-0.5 flex-1 bg-border min-h-[32px]" />
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium text-foreground">Reza Karim assigned</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Picked up by your support engineer.</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-1">2d ago</p>
                      </div>
                    </div>
                  )}

                  {(comments ?? []).length > 0 && (
                    <div className="flex gap-3.5">
                      <div className="flex flex-col items-center">
                        <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                          <Activity className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Update from engineer</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Investigating sensor re-registration after the OS patch.</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-1">30 Jun · 10:40</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {showFeedbackTab && (
              <TabsContent value="feedback" className="mt-4 space-y-4">
                {feedback ? (
                  <>
                    <div className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-5 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <RatingGauge rating={feedback.rating ?? 0} />
                        {feedback.ml_reviewed && (
                          <Badge variant="secondary" className="text-[10px] gap-1 h-5 px-1.5 shrink-0">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Reviewed
                          </Badge>
                        )}
                      </div>
                      {feedback.feedback_text && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Comment</p>
                          <p className="text-sm text-foreground leading-relaxed italic">&ldquo;{feedback.feedback_text}&rdquo;</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between flex-wrap gap-1 pt-1 border-t">
                        {client && <p className="text-xs font-medium text-foreground">{client.company_name}</p>}
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(feedback.created_at)}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border bg-card p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Question Breakdown</p>
                      {!feedback.question_ratings && (
                        <p className="text-xs text-muted-foreground mb-3">Submitted before per-question ratings existed — only the overall score above is available.</p>
                      )}
                      <div className="divide-y">
                        {FEEDBACK_QUESTIONS.map((q) => (
                          <div key={q.key} className="flex items-center justify-between gap-3 py-2">
                            <span className="text-sm text-foreground">{q.label}</span>
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }, (_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3.5 w-3.5 ${(feedback.question_ratings?.[q.key] ?? 0) > i ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/20'}`}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border bg-card p-8 text-center">
                    <div className="flex justify-center gap-0.5 mb-2">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} className="h-5 w-5 text-muted-foreground/15" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">Awaiting client feedback</p>
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Submit for closure — engineer marks the case resolved; the client then
              gives feedback and accepts or reopens it from their own case view. */}
          {canResolve && !isNewCase && !['resolved', 'pending_closure', 'closed'].includes(case_.status) && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 space-y-3">
              <h3 className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Ready to Close?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Submit your resolution. The client will review it, give feedback, and either accept the closure or reopen the case.
              </p>
              <Button
                size="sm"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setResolveOpen(true)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Submit for Closure
              </Button>
            </div>
          )}

          {case_.status === 'resolved' && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 space-y-1">
              <h3 className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Awaiting Client Response
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Resolution submitted — waiting for the client to give feedback and accept or reopen the case.
              </p>
            </div>
          )}

          {/* Client */}
          {client && session.role !== 'client' && (
            <div className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4 space-y-2.5">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Client
              </h3>
              <div className="flex items-start gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-primary">{client.company_name.charAt(0)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{client.company_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{client.contact_person}</p>
                  <p className="text-xs text-muted-foreground">{client.phone}</p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/cases?search=${encodeURIComponent(client.company_name)}`)}
                className="w-full text-center text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-lg py-1.5 transition-colors"
              >
                View all cases for {client.company_name} &rarr;
              </button>
            </div>
          )}

          {/* Solution */}
          {solution && (
            <div className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4 space-y-2.5">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Solution</h3>
              <div className="flex items-start gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-sky-600 dark:text-sky-400">{solution.name.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{solution.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{solution.category}</p>
                </div>
              </div>
            </div>
          )}

          {/* Assigned — Team + Lead + Engineers */}
          {(() => {
            const team    = case_.team_id ? teamsMap[case_.team_id] : null
            const lead    = team ? usersMap[team.lead_user_id] : null
            const isClosed = case_.status === 'closed'

            return (
              <div className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4 space-y-4">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Assigned
                </h3>

                {/* Team row */}
                {team && (
                  <div className="rounded-lg bg-muted/30 p-2.5 space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Users className="h-3 w-3" /> Team
                    </p>
                    <p className="text-sm font-semibold text-foreground">{team.name}</p>
                  </div>
                )}

                {/* Team Lead */}
                {lead && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Team Lead</p>
                    <div className="flex items-center gap-2.5 rounded-lg bg-muted/20 p-2">
                      <UserAvatar name={lead.name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">{lead.name}</p>
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
                        <div className="space-y-1.5">
                          {allCurrentEngineers.map((eng) => {
                            const isOwner = eng.id === case_.assignee_id
                            const isCoAssignee = (case_.co_assignee_ids ?? []).includes(eng.id)
                            return (
                              <div key={eng.id} className={`flex items-center gap-2.5 rounded-lg p-2 ${
                                isOwner
                                  ? 'bg-muted/20 border-l-2 border-l-blue-500 dark:border-l-blue-400'
                                  : 'bg-muted/20'
                              }`}>
                                <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
                                  isOwner
                                    ? 'bg-blue-500 text-white text-xs font-bold'
                                    : ''
                                }`}>
                                  {isOwner ? (
                                    eng.name.charAt(0).toUpperCase()
                                  ) : (
                                    <UserAvatar name={eng.name} size="sm" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-medium truncate text-foreground">{eng.name}</p>
                                    {isOwner && !isClosed && (
                                      <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 text-[9px] font-medium text-blue-700 dark:text-blue-300">Owner</span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">
                                    {ROLE_LABELS[eng.role] ?? eng.role}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {isClosed
                                    ? <Badge variant="secondary" className="text-[10px]">{isOwner ? 'Lead' : 'Support'}</Badge>
                                    : !isOwner && <Badge variant="secondary" className="text-[10px]">Co-assignee</Badge>
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
                          <p className="text-[10px] text-muted-foreground">Set owner</p>
                          <Select
                            value={case_.assignee_id ?? ''}
                            onValueChange={(uid) => {
                              dp.assignCase(caseId, uid, scope).then(() => {
                                qc.invalidateQueries({ queryKey: ['case', caseId] })
                                qc.invalidateQueries({ queryKey: ['notifications'] })
                                toast({ title: 'Owner updated', variant: 'success' })
                              }).catch((e: unknown) => toast({ title: String(e), variant: 'destructive' }))
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Assign owner..." />
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

          {/* Client Feedback — only after resolution */}
          {!isSubCase && ['resolved', 'closed', 'pending_closure'].includes(case_.status) && (
          <div className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4 space-y-3">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-yellow-500" /> Client Feedback
            </h3>

            {feedback ? (
              <>
                {/* Star rating */}
                {feedback.rating != null ? (
                  <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < feedback.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/20'}`}
                        />
                      ))}
                      <span className="text-sm font-bold ml-1.5 text-foreground">
                        {feedback.rating}
                        <span className="text-xs font-normal text-muted-foreground"> / 5</span>
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {feedback.rating >= 4 ? 'Excellent' : feedback.rating === 3 ? 'Satisfactory' : 'Needs improvement'}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 rounded-lg bg-muted/30 p-2.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className="h-4 w-4 text-muted-foreground/20" />
                    ))}
                    <span className="text-xs text-muted-foreground ml-2">No rating given</span>
                  </div>
                )}

                {/* Feedback text */}
                {feedback.feedback_text && (
                  <div className="relative pl-3 border-l-2 border-yellow-300 dark:border-yellow-700">
                    <p className="text-xs text-muted-foreground italic leading-relaxed">&ldquo;{feedback.feedback_text}&rdquo;</p>
                  </div>
                )}

                {/* Client + timestamp + reviewed badge */}
                <div className="flex items-center justify-between flex-wrap gap-1 pt-1">
                  <div className="space-y-0.5">
                    {client && (
                      <p className="text-xs font-medium text-foreground">{client.company_name}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">{formatDateTime(feedback.created_at)}</p>
                  </div>
                  {feedback.ml_reviewed && (
                    <Badge variant="secondary" className="text-[10px] gap-1 h-5 px-1.5">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Reviewed
                    </Badge>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-lg bg-muted/30 py-4 space-y-2">
                <div className="flex justify-center gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className="h-5 w-5 text-muted-foreground/15" />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">Awaiting client feedback</p>
              </div>
            )}
          </div>
          )}

          <ExternalMembersCard caseId={caseId} readOnly={session.role === 'sales_executive'} />
        </div>
      </div>

      {/* Workflow action dialogs */}
      <ResolveCaseDialog caseId={caseId} open={resolveOpen} onOpenChange={setResolveOpen} />
      <RequestClientInfoDialog caseId={caseId} open={clientInfoOpen} onOpenChange={setClientInfoOpen} />
      <UpdateProgressDialog caseId={caseId} open={progressOpen} onOpenChange={setProgressOpen} />

      {/* Floating comment widget */}
      {canComment && !['closed'].includes(case_.status) && (
        <>
          {/* Toggle button */}
          <button
            onClick={() => setChatOpen((v) => !v)}
            className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 hover:shadow-xl transition-all flex items-center justify-center"
          >
            {chatOpen ? <XCircle className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
            {!chatOpen && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow">1</span>
            )}
          </button>

          {/* Comment panel */}
          {chatOpen && (
            <div className="fixed bottom-24 right-6 z-50 w-[380px] rounded-xl border bg-card shadow-2xl flex flex-col h-[480px] animate-in slide-in-from-bottom-5 fade-in duration-200">
              <div className="px-4 pt-3 pb-1 flex items-center justify-between border-b">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comments</h3>
                <button onClick={() => setChatOpen(false)} className="h-6 w-6 rounded-md hover:bg-muted-foreground/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex-1 px-4 pb-2 space-y-3 overflow-y-auto min-h-0 py-3">
                <div className="flex items-start gap-2">
                  <UserAvatar name="Reza Karim" size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">Reza Karim</span>
                      <span className="text-[10px] text-muted-foreground">30 Jun · 10:40</span>
                    </div>
                    <p className="text-xs text-foreground mt-0.5">Investigating sensor re-registration after the OS patch. Need a maintenance window to proceed.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 flex-row-reverse">
                  <UserAvatar name="You" size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-row-reverse">
                      <span className="text-xs font-medium">You</span>
                      <span className="text-[10px] text-muted-foreground">30 Jun · 11:15</span>
                    </div>
                    <p className="text-xs text-foreground mt-0.5 bg-primary/10 rounded-lg px-3 py-1.5">We can schedule it tonight after 11 PM. Let me know what you need from our side.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <UserAvatar name="Reza Karim" size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">Reza Karim</span>
                      <span className="text-[10px] text-muted-foreground">30 Jun · 11:42</span>
                    </div>
                    <p className="text-xs text-foreground mt-0.5">Perfect. I'll prepare the script and be ready at 11 PM. Will send a confirmation once done.</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-border p-3 space-y-2">
                <div className="flex items-end gap-2 bg-muted/40 dark:bg-muted/10 rounded-xl p-1.5 ring-1 ring-border focus-within:ring-2 focus-within:ring-primary/30 transition-all">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    id="comment-attach"
                    onChange={(e) => { handleCommentFiles(e.target.files); e.target.value = '' }}
                  />
                  <label htmlFor="comment-attach" className="shrink-0 flex items-center justify-center h-9 w-9 rounded-lg hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                    <Paperclip className="h-4 w-4" />
                  </label>
                  <Textarea
                    placeholder="Reply to your engineer…"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    rows={1}
                    className="flex-1 min-h-0 border-0 bg-transparent resize-none px-1 py-2 text-sm shadow-none focus-visible:ring-0"
                  />
                  <Button
                    size="icon"
                    className="shrink-0 h-9 w-9 rounded-lg"
                    disabled={!commentBody.trim() || addCommentMutation.isPending}
                    onClick={() => addCommentMutation.mutate({ body: commentBody, parentId: null, isInternal })}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-3 px-1">
                  <button
                    type="button"
                    onClick={() => setIsInternal((v) => !v)}
                    className={`inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 transition-colors ${
                      isInternal
                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <Lock className="h-3 w-3" />
                    {isInternal ? 'Internal' : 'External'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  )
}
