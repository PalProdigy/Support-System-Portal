'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { UserAvatar } from '@/components/shared/user-avatar'
import { ErrorState } from '@/components/shared/error-state'
import { ExternalMembersCard } from '@/components/shared/external-members-card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { getCategoryMeta } from '@/lib/products-shared'
import { ROLE_LABELS } from '@/lib/rbac'
import { SubProjectsSection } from './sub-projects-section'
import {
  ArrowLeft, FolderKanban, Building2, Package, Calendar, Crown, Users,
  Send, MessageCircle, X, XCircle,
} from 'lucide-react'

export default function ProjectDetail({ projectId }: { projectId: string }) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()

  const [chatOpen, setChatOpen] = useState(false)
  const [commentBody, setCommentBody] = useState('')

  const { data: project, isLoading, error, refetch } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => dp.getProject(projectId),
  })

  const { data: client } = useQuery({
    queryKey: ['client', project?.client_id],
    queryFn: () => dp.getClient(project!.client_id),
    enabled: !!project?.client_id,
  })

  const { data: parentProject } = useQuery({
    queryKey: ['project', project?.parent_project_id],
    queryFn: () => dp.getProject(project!.parent_project_id!),
    enabled: !!project?.parent_project_id,
  })

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => dp.listProducts() })

  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ['project-comments', projectId],
    queryFn: () => dp.listProjectComments(projectId),
    enabled: !!project,
  })

  const usersMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]))
  const product = project?.product_id ? (products ?? []).find((p) => p.id === project.product_id) : undefined
  const meta = product ? getCategoryMeta(product.category) : null

  const addCommentMutation = useMutation({
    mutationFn: (body: string) =>
      dp.addProjectComment({ project_id: projectId, author_id: session.userId, body }),
    onSuccess: () => {
      setCommentBody('')
      qc.invalidateQueries({ queryKey: ['project-comments', projectId] })
      toast({ title: 'Comment added', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to add comment', variant: 'destructive' }),
  })

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }
  if (error || !project) return <ErrorState message="Project not found or access denied." onRetry={refetch} />

  const handlers = project.handler_ids.map((id) => usersMap[id]).filter((u): u is NonNullable<typeof u> => !!u)
  const [primary, ...support] = handlers

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => router.push('/projects')}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Projects
        </Button>

        {parentProject && (
          <button
            onClick={() => router.push(`/projects/${parentProject.id}`)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors -mt-2"
          >
            Sub task of <span className="font-medium">{parentProject.title}</span>
          </button>
        )}

        <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            {meta ? (
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold tracking-wide shrink-0"
                style={{ background: meta.tint, color: meta.color }}
              >
                {meta.mono}
              </div>
            ) : (
              <div className="rounded-xl bg-primary/15 p-3 shrink-0">
                <FolderKanban className="h-7 w-7 text-primary" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">{project.title}</h1>
              </div>
              {project.description && <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{project.description}</p>}
              <div className="flex items-center gap-3 flex-wrap mt-2.5 text-xs text-muted-foreground">
                {client && (
                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {client.company_name}</span>
                )}
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Created {formatDate(project.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column — Workflow (sub tasks don't nest further sub tasks) */}
        <div className="lg:col-span-2 space-y-6">
          {!project.parent_project_id && <SubProjectsSection parentProject={project} />}
        </div>

        {/* Side column */}
        <div className="space-y-5">
          {client && (
            <div className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4 space-y-2.5">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Client
              </h3>
              <p className="text-sm font-semibold text-foreground">{client.company_name}</p>
              {client.contact_person && <p className="text-xs text-muted-foreground">{client.contact_person}</p>}
              {client.email && <p className="text-xs text-muted-foreground">{client.email}</p>}
            </div>
          )}

          {product && meta && (
            <div className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4 space-y-2.5">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Product
              </h3>
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold shrink-0"
                  style={{ background: meta.tint, color: meta.color }}
                >
                  {meta.mono}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{product.category}</p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4 space-y-3">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Assigned
            </h3>
            {handlers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No engineers assigned yet.</p>
            ) : (
              <div className="space-y-1.5">
                {primary && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-2">
                    <UserAvatar name={primary.name} avatarUrl={primary.avatar} userId={primary.id} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{primary.name}</p>
                      <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[primary.role] ?? primary.role}</p>
                    </div>
                    <span className="flex items-center gap-0.5 text-[9px] font-semibold text-primary uppercase tracking-wide shrink-0">
                      <Crown className="h-2.5 w-2.5" /> Primary
                    </span>
                  </div>
                )}
                {support.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 rounded-lg border px-2.5 py-2">
                    <UserAvatar name={u.name} avatarUrl={u.avatar} userId={u.id} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[u.role] ?? u.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <ExternalMembersCard projectId={projectId} readOnly={session.role === 'sales_executive'} />
        </div>
      </div>

      {/* Floating global comment widget */}
      <button
        onClick={() => setChatOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 hover:shadow-xl transition-all flex items-center justify-center"
      >
        {chatOpen ? <XCircle className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {!chatOpen && (comments?.length ?? 0) > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow">
            {comments!.length}
          </span>
        )}
      </button>

      {chatOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] rounded-xl border bg-card shadow-2xl flex flex-col h-[480px] animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="px-4 pt-3 pb-1 flex items-center justify-between border-b">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Global Comment</h3>
            <button onClick={() => setChatOpen(false)} className="h-6 w-6 rounded-md hover:bg-muted-foreground/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 px-4 pb-2 space-y-3 overflow-y-auto min-h-0 py-3">
            {commentsLoading ? (
              <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
            ) : (comments ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No comments yet. Start the conversation.</p>
            ) : (
              (comments ?? []).map((c) => {
                const author = usersMap[c.author_id]
                const mine = c.author_id === session.userId
                return (
                  <div key={c.id} className={cn('flex items-start gap-2', mine && 'flex-row-reverse')}>
                    <UserAvatar name={author?.name ?? '?'} avatarUrl={author?.avatar} userId={author?.id} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className={cn('flex items-center gap-1.5', mine && 'flex-row-reverse')}>
                        <span className="text-xs font-medium">{mine ? 'You' : author?.name ?? 'Unknown'}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDateTime(c.created_at)}</span>
                      </div>
                      <p className={cn('text-xs text-foreground mt-0.5', mine && 'bg-primary/10 rounded-lg px-3 py-1.5')}>
                        {c.body}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          {session.role !== 'sales_executive' && (
            <div className="border-t border-border p-3">
              <div className="flex items-end gap-2 bg-muted/40 dark:bg-muted/10 rounded-xl p-1.5 ring-1 ring-border focus-within:ring-2 focus-within:ring-primary/30 transition-all">
                <Textarea
                  placeholder="Add a comment…"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  rows={1}
                  className="flex-1 min-h-0 border-0 bg-transparent resize-none px-2 py-2 text-sm shadow-none focus-visible:ring-0"
                />
                <Button
                  size="icon"
                  className="shrink-0 h-9 w-9 rounded-lg"
                  disabled={!commentBody.trim() || addCommentMutation.isPending}
                  onClick={() => addCommentMutation.mutate(commentBody.trim())}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
