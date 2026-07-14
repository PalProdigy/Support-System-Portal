'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { WorkTimer } from './work-timer'
import { RCAForm } from './rca-form'
import {
  cn, formatDateTime, formatDate, slaRemainingMs, formatDuration,
  PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS, CLIENT_STATUS_LABELS,
} from '@/lib/utils'
import {
  Play, MessageSquare, Lock, Paperclip, Upload, X, Clock,
  AlertCircle, CheckCircle2, ArrowRight, Send, Download,
} from 'lucide-react'
import { formatBytes } from '@/lib/utils'
import type { Attachment } from '@/types'

type WorkspaceTab = 'updates' | 'rca' | 'attachments'

interface Props { caseId: string }

export function CaseWorkspace({ caseId }: Props) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [tab, setTab] = useState<WorkspaceTab>('updates')
  const [commentBody, setCommentBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [files, setFiles] = useState<File[]>([])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['case', caseId] })
    qc.invalidateQueries({ queryKey: ['cases'] })
    qc.invalidateQueries({ queryKey: ['audit-logs', caseId] })
  }

  const { data: caseData, isLoading } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => dp.getCase(caseId, scope),
    refetchInterval: 60_000,
  })

  const { data: comments } = useQuery({
    queryKey: ['comments', caseId],
    queryFn: () => dp.listComments(caseId, scope),
  })

  const { data: attachments } = useQuery({
    queryKey: ['attachments', caseId],
    queryFn: () => dp.listAttachments(caseId),
  })

  const { data: clients } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => dp.listClients({ userId: session.userId, role: 'team_lead' }),
  })

  const { data: solutions } = useQuery({
    queryKey: ['solutions'],
    queryFn: () => dp.listSolutions(),
  })

  const startWorkMutation = useMutation({
    mutationFn: () => dp.startWork(caseId, scope),
    onSuccess: () => { invalidate(); toast({ title: 'Work started — case is now In Progress', variant: 'success' }) },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  const pendingClientMutation = useMutation({
    mutationFn: () => dp.requestClientInfo(caseId, scope),
    onSuccess: () => { invalidate(); toast({ title: 'Client notified — SLA paused', variant: 'success' }) },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  const resolveMutation = useMutation({
    mutationFn: () => dp.resolveCase(caseId, scope),
    onSuccess: () => { invalidate(); toast({ title: 'Case resolved — client and lead notified', variant: 'success' }) },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  const commentMutation = useMutation({
    mutationFn: () => dp.addComment({ case_id: caseId, author_id: session.userId, body: commentBody.trim(), is_internal: isInternal }, scope),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', caseId] })
      setCommentBody('')
      toast({ title: isInternal ? 'Internal note added' : 'Update posted', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to post', variant: 'destructive' }),
  })

  const uploadMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(files.map((f) =>
        dp.addAttachment({
          case_id: caseId, uploaded_by: session.userId,
          file_url: `mock://uploads/${caseId}/${f.name}`,
          file_name: f.name, file_type: f.type || 'application/octet-stream',
          category: 'attachment', size: f.size,
        } as Omit<Attachment, 'id' | 'created_at'>)
      ))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attachments', caseId] })
      setFiles([])
      toast({ title: 'Files uploaded', variant: 'success' })
    },
    onError: () => toast({ title: 'Upload failed', variant: 'destructive' }),
  })

  if (isLoading) return (
    <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
  )
  if (!caseData) return <div className="text-center py-8 text-muted-foreground">Case not found or not accessible.</div>

  const client = clients?.find((c) => c.id === caseData.client_id)
  const solution = solutions?.find((s) => s.id === caseData.solution_id)
  const remaining = slaRemainingMs(caseData.sla_due_at)
  const slaBreached = remaining < 0
  const isActive = !['closed', 'resolved', 'pending_closure'].includes(caseData.status)

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Case header */}
      <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground">{caseData.reference_no}</span>
              <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', PRIORITY_COLORS[caseData.priority])}>
                {PRIORITY_LABELS[caseData.priority]}
              </span>
              {caseData.is_escalated && (
                <Badge variant="destructive" className="text-[10px]">Escalated</Badge>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground break-words">{caseData.title}</h1>
            <p className="text-sm text-muted-foreground break-words">{caseData.description}</p>
          </div>
          <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full shrink-0', STATUS_COLORS[caseData.status])}>
            {STATUS_LABELS[caseData.status]}
          </span>
        </div>

        {/* Info row */}
        <div className="flex flex-wrap gap-4 text-sm border-t pt-3">
          {client && (
            <div className="space-y-0.5 min-w-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Client</p>
              <p className="font-medium truncate">{client.company_name}</p>
              <p className="text-xs text-muted-foreground truncate">{client.contact_person}</p>
            </div>
          )}
          {solution && (
            <div className="space-y-0.5 min-w-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Solution</p>
              <p className="font-medium truncate">{solution.name}</p>
              <p className="text-xs text-muted-foreground truncate">{solution.category}</p>
            </div>
          )}
          <div className="space-y-0.5 min-w-0">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Opened</p>
            <p className="font-medium">{formatDate(caseData.created_at)}</p>
          </div>
        </div>

        {/* SLA + Timer row */}
        <div className="flex items-center gap-3 flex-wrap border-t pt-3">
          <div className={cn('flex items-center gap-1.5 text-sm font-medium', slaBreached ? 'text-red-600 dark:text-red-400' : remaining < 4 * 3600 * 1000 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
            <Clock className="h-4 w-4 shrink-0" />
            {isActive ? (slaBreached ? `SLA breached ${formatDuration(Math.abs(remaining))} ago` : `${formatDuration(remaining)} remaining`) : STATUS_LABELS[caseData.status]}
          </div>
          <WorkTimer />
        </div>
      </div>

      {/* Status action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {caseData.status === 'assigned' && (
          <Button onClick={() => startWorkMutation.mutate()} disabled={startWorkMutation.isPending}>
            <Play className="h-4 w-4" />
            {startWorkMutation.isPending ? 'Starting…' : 'Start Work'}
          </Button>
        )}
        {caseData.status === 'in_progress' && (
          <>
            <Button variant="outline" onClick={() => pendingClientMutation.mutate()} disabled={pendingClientMutation.isPending}>
              <MessageSquare className="h-4 w-4" />
              {pendingClientMutation.isPending ? 'Notifying…' : 'Need Client Info'}
            </Button>
            <Button onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="h-4 w-4" />
              {resolveMutation.isPending ? 'Resolving…' : 'Mark Resolved'}
            </Button>
          </>
        )}
        {caseData.status === 'pending_client' && (
          <>
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Waiting for client response — SLA paused</span>
            </div>
            <Button onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="h-4 w-4" />
              {resolveMutation.isPending ? 'Resolving…' : 'Mark Resolved'}
            </Button>
          </>
        )}
        {caseData.status === 'resolved' && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Case resolved — awaiting client feedback for closure</span>
          </div>
        )}
        {caseData.status === 'pending_closure' && (
          <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 rounded-lg px-3 py-2 border border-violet-200 dark:border-violet-700">
            <ArrowRight className="h-4 w-4 shrink-0" />
            <span>Feedback received — pending Team Lead closure review</span>
          </div>
        )}
        {caseData.status === 'closed' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 border">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Case closed on {formatDate(caseData.closed_at ?? caseData.created_at)}</span>
          </div>
        )}
        {caseData.status === 'escalated' && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2 border border-red-200 dark:border-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Case escalated to Technical Head</span>
          </div>
        )}
      </div>

      {/* Workspace tabs */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center border-b bg-muted/20 overflow-x-auto">
          {([['updates', 'Updates', MessageSquare], ['rca', 'RCA', FileSearch], ['attachments', 'Attachments', Paperclip]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key as WorkspaceTab)}
              className={cn(
                'flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors shrink-0',
                tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {key === 'attachments' && (attachments?.length ?? 0) > 0 && (
                <span className="ml-1 text-[10px] bg-muted text-muted-foreground rounded-full px-1.5">{attachments!.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-4">
          {/* Updates tab */}
          {tab === 'updates' && (
            <div className="space-y-4">
              {/* Comment thread */}
              {(comments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No updates yet.</p>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {(comments ?? []).map((c) => (
                    <div key={c.id} className={cn('rounded-lg border p-3 space-y-1', c.is_internal ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-700' : 'bg-card border-border')}>
                      <div className="flex items-center gap-2 flex-wrap">
                        {c.is_internal && <Lock className="h-3 w-3 text-amber-600 shrink-0" />}
                        <span className="text-xs font-semibold text-foreground">{c.author_id === session.userId ? 'You' : `Engineer (${c.author_id.slice(0, 4)})`}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDateTime(c.created_at)}</span>
                        {c.is_internal && <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-full sm:ml-auto">Internal</span>}
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">{c.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* New comment form */}
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <Label className="text-sm font-medium">Add update</Label>
                  <button
                    type="button"
                    onClick={() => setIsInternal((v) => !v)}
                    className={cn('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors', isInternal ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300' : 'bg-muted border-border text-muted-foreground')}
                  >
                    <Lock className="h-3 w-3" />
                    {isInternal ? 'Internal note' : 'Public update'}
                  </button>
                </div>
                <Textarea
                  rows={3}
                  placeholder={isInternal ? 'Internal note — only visible to staff…' : 'Post an update to the client…'}
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  className={isInternal ? 'border-amber-300 dark:border-amber-600 bg-amber-50/30 dark:bg-amber-950/10' : ''}
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => commentMutation.mutate()} disabled={commentBody.trim().length < 3 || commentMutation.isPending}>
                    <Send className="h-3.5 w-3.5" />
                    {commentMutation.isPending ? 'Posting…' : 'Post'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* RCA tab */}
          {tab === 'rca' && <RCAForm caseId={caseId} />}

          {/* Attachments tab */}
          {tab === 'attachments' && (
            <div className="space-y-4">
              {(attachments ?? []).length > 0 && (
                <div className="space-y-1.5">
                  {attachments!.map((att) => (
                    <div key={att.id} className="flex items-center gap-2 flex-wrap rounded-lg bg-muted/40 px-3 py-2">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground flex-1 min-w-[8rem] truncate">{att.file_name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{formatBytes(att.size)}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">{formatDate(att.created_at)}</span>
                      <a href={att.file_url} target="_blank" rel="noreferrer" className="text-primary hover:text-primary/80 shrink-0">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex flex-col sm:flex-row items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 p-6 cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground text-center">
                <Upload className="h-4 w-4 shrink-0" />
                <span>Click to upload logs, screenshots, or supporting files</span>
                <input type="file" multiple className="sr-only" onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])])} />
              </label>
              {files.length > 0 && (
                <div className="space-y-1.5">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                      <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="flex-1 min-w-0 truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{formatBytes(f.size)}</span>
                      <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive shrink-0">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <Button size="sm" onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending}>
                    <Upload className="h-3.5 w-3.5" />
                    {uploadMutation.isPending ? 'Uploading…' : `Upload ${files.length} file${files.length > 1 ? 's' : ''}`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Mini icon for RCA tab (not in lucide v4 so use a simple inline SVG symbol)
function FileSearch({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <circle cx="11.5" cy="14.5" r="2.5" />
      <path d="M13.25 16.25 15 18" />
    </svg>
  )
}
