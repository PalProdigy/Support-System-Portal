'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/shared/user-avatar'
import { toast } from '@/hooks/use-toast'
import { cn, formatDateTime, formatDuration } from '@/lib/utils'
import { GitBranch, Plus, ChevronDown, ChevronRight, Clock, CheckCircle2, Send, Paperclip, FileText } from 'lucide-react'
import { AddSubProjectDialog } from './add-sub-project-dialog'
import type { Project, User } from '@/types'

// Real worked hours since the task was started. The running (current) task's
// clock keeps ticking to now; a superseded task's clock freezes at the moment
// the next sub task was created — that's when work moved off it.
function workHours(sub: Project, frozenAt?: string): string | null {
  if (!sub.started_at) return null
  const endMs = frozenAt ? new Date(frozenAt).getTime() : Date.now()
  return formatDuration(endMs - new Date(sub.started_at).getTime())
}

function SubProjectRow({
  sub, isActive, frozenAt, isOpen, onToggle, usersMap,
}: {
  sub: Project
  isActive: boolean
  frozenAt?: string
  isOpen: boolean
  onToggle: () => void
  usersMap: Record<string, User>
}) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const [replyBody, setReplyBody] = useState('')

  const { data: comments } = useQuery({
    queryKey: ['project-comments', sub.id],
    queryFn: () => dp.listProjectComments(sub.id),
    enabled: isOpen,
  })

  const { data: attachments } = useQuery({
    queryKey: ['project-attachments', sub.id],
    queryFn: () => dp.listProjectAttachments(sub.id),
    enabled: isOpen,
  })

  const replyMutation = useMutation({
    mutationFn: (body: string) => dp.addProjectComment({ project_id: sub.id, author_id: session.userId, body }),
    onSuccess: () => {
      setReplyBody('')
      qc.invalidateQueries({ queryKey: ['project-comments', sub.id] })
    },
    onError: () => toast({ title: 'Failed to add reply', variant: 'destructive' }),
  })

  const attachMutation = useMutation({
    mutationFn: (file: File) =>
      dp.addProjectAttachment({
        project_id: sub.id,
        uploaded_by: session.userId,
        file_url: URL.createObjectURL(file),
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        size: file.size,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-attachments', sub.id] }),
    onError: () => toast({ title: 'Failed to attach file', variant: 'destructive' }),
  })

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    Array.from(fileList).forEach((f) => attachMutation.mutate(f))
  }

  const primaryHandler = sub.handler_ids[0] ? usersMap[sub.handler_ids[0]] : undefined
  const isDone = !isActive
  const hours = workHours(sub, frozenAt)
  const canEdit = session.role !== 'sales_executive'

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-all',
      isActive
        ? 'border-blue-400 dark:border-blue-500 bg-card shadow-[0_0_14px_-3px] shadow-blue-400/50 dark:shadow-blue-600/50'
        : 'bg-card hover:shadow-sm'
    )}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left p-3 hover:bg-accent/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-full', isActive ? 'bg-blue-500 animate-pulse' : isDone ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
          <p className="text-sm font-medium">{sub.title}</p>
          {isDone && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
        </div>
        <span className={cn('text-xs flex items-center gap-1', isActive ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-muted-foreground')}>
          {(isActive || hours) && (
            <>
              <Clock className={cn('h-3 w-3', isActive && 'animate-pulse')} />
              {isActive ? 'running' : hours}
            </>
          )}
          {isOpen ? <ChevronDown className="h-3.5 w-3.5 ml-1" /> : <ChevronRight className="h-3.5 w-3.5 ml-1" />}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-3">
          {primaryHandler && (
            <div className="flex items-center gap-2">
              <UserAvatar name={primaryHandler.name} avatarUrl={primaryHandler.avatar} userId={primaryHandler.id} size="sm" />
              <span className="text-xs font-medium">{primaryHandler.name}</span>
            </div>
          )}

          {(comments ?? []).length > 0 && (
            <div className="space-y-2 pl-4 border-l-2 border-muted">
              {(comments ?? []).map((c) => {
                const author = usersMap[c.author_id]
                return (
                  <div key={c.id} className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">{author?.name ?? 'Unknown'}</span>
                    <span className="text-muted-foreground/50 ml-1">{formatDateTime(c.created_at)}</span>
                    <p className="mt-0.5">{c.body}</p>
                  </div>
                )
              })}
            </div>
          )}

          {(attachments ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachments!.map((a) => (
                <a
                  key={a.id}
                  href={a.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <FileText className="h-3 w-3 text-muted-foreground" /> {a.file_name}
                </a>
              ))}
            </div>
          )}

          {isActive && canEdit && (
            <div className="flex items-end gap-1.5 pt-1 bg-muted/30 dark:bg-muted/5 rounded-lg p-1.5 ring-1 ring-border focus-within:ring-2 focus-within:ring-primary/30 transition-all">
              <input
                type="file"
                multiple
                className="hidden"
                id={`sub-attach-${sub.id}`}
                onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
              />
              <label
                htmlFor={`sub-attach-${sub.id}`}
                className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </label>
              <Textarea
                placeholder="Reply to your engineer…"
                rows={1}
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                className="flex-1 min-h-0 border-0 bg-transparent resize-none px-1 py-1.5 text-xs shadow-none focus-visible:ring-0"
              />
              <Button
                size="icon"
                className="shrink-0 h-7 w-7 rounded-md"
                disabled={!replyBody.trim() || replyMutation.isPending}
                onClick={() => replyMutation.mutate(replyBody.trim())}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function SubProjectsSection({ parentProject }: { parentProject: Project }) {
  const dp = getDataProvider()
  const session = useSession()
  const canEdit = session.role !== 'sales_executive'

  const [addOpen, setAddOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data: subProjects, isLoading } = useQuery({
    queryKey: ['sub-projects', parentProject.id],
    queryFn: () => dp.listSubProjects(parentProject.id),
  })

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))

  const subs = subProjects ?? []

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-sm font-semibold">Workflow</h2>
        {canEdit && (
          <Button size="sm" variant="outline" className="h-8" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Case Update
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : subs.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No case updates"
          description={canEdit ? 'Break this project into smaller work items with "Add Case Update".' : 'No case updates yet.'}
        />
      ) : (
        <div className="space-y-3">
          {subs.map((s, i) => (
            <SubProjectRow
              key={s.id}
              sub={s}
              isActive={i === subs.length - 1}
              frozenAt={subs[i + 1]?.created_at}
              isOpen={expanded.has(s.id)}
              onToggle={() => toggleExpand(s.id)}
              usersMap={usersMap}
            />
          ))}
        </div>
      )}

      {addOpen && <AddSubProjectDialog parentProject={parentProject} open={addOpen} onOpenChange={setAddOpen} />}
    </div>
  )
}
