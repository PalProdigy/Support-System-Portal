'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { ROLE_LABELS } from '@/lib/rbac'
import { formatDate, cn } from '@/lib/utils'
import { BookOpen, PlusCircle, Search, Eye, MessageCircle, Pencil, Trash2, CheckCircle2, XCircle, X, ClipboardList, Clock, User as UserIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  CommentThread,
  buildOptimisticComment,
  applyCommentReaction,
  removeCommentAndDescendants,
} from '@/components/shared/comment-thread'
import type { KBArticle } from '@/types'

type Banner = { kind: 'success' | 'error'; message: string }

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  archived: 'bg-muted text-muted-foreground',
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function KnowledgeBasePage() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<KBArticle | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [commentingId, setCommentingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<KBArticle | null>(null)
  const [deleting, setDeleting] = useState<KBArticle | null>(null)
  const [rejecting, setRejecting] = useState<KBArticle | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [banner, setBanner] = useState<Banner | null>(null)
  const [form, setForm] = useState({ title: '', body: '', tags: '' })
  const [editForm, setEditForm] = useState({ title: '', body: '', tags: '', status: 'draft' as KBArticle['status'] })

  const isTH = session.role === 'technical_head'
  const kbKey = ['kb', search, status] as const
  const pendingKey = ['kb', 'pending'] as const

  // Auto-dismiss result banner after a few seconds
  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 5000)
    return () => clearTimeout(t)
  }, [banner])

  const { data: articles, isLoading } = useQuery({
    queryKey: kbKey,
    queryFn: () => dp.listKBArticles({ search: search || undefined, status: status === 'all' ? undefined : status }, scope),
  })
  const { data: currentUser } = useQuery({ queryKey: ['user', session.userId], queryFn: () => dp.getUser(session.userId) })

  // Technical Head review queue — all pending articles, independent of the list filters.
  const { data: pendingArticles } = useQuery({
    queryKey: pendingKey,
    queryFn: () => dp.listKBArticles({ status: 'pending' }, scope),
    enabled: isTH,
  })

  // Public list: only published articles + the current user's own submissions.
  const visibleArticles = (articles ?? []).filter(
    (a: KBArticle) => a.status === 'published' || a.author_id === session.userId,
  )

  // Edit + delete are allowed for the Technical Head or the article's own author.
  const canEditArticle = (a: KBArticle) => isTH || a.author_id === session.userId

  function openEdit(a: KBArticle) {
    setEditing(a)
    setEditForm({ title: a.title, body: a.body, tags: a.tags.join(', '), status: a.status })
  }

  const editMutation = useMutation({
    mutationFn: () =>
      dp.updateKBArticle(editing!.id, {
        title: editForm.title,
        body: editForm.body,
        tags: editForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
        status: editForm.status,
        // Stamp published_at the first time it goes live; otherwise keep as-is.
        published_at: editForm.status === 'published' ? (editing!.published_at ?? new Date().toISOString()) : editing!.published_at,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb'] })
      toast({ title: 'Article updated', variant: 'success' })
      setEditing(null)
    },
    onError: () => toast({ title: 'Failed to update article', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dp.deleteKBArticle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb'] })
      toast({ title: 'Article deleted', variant: 'success' })
      setDeleting(null)
    },
    onError: () => toast({ title: 'Failed to delete article', variant: 'destructive' }),
  })

  // Live article behind the open comment dialog (kept in sync with the cache)
  const commenting = (articles ?? []).find((a: KBArticle) => a.id === commentingId) ?? null

  // Optimistically patch one article in the current kb query; returns a rollback fn.
  function optimisticPatchArticle(id: string, mapper: (a: KBArticle) => KBArticle) {
    const prev = qc.getQueryData<KBArticle[]>(kbKey)
    qc.setQueryData<KBArticle[]>(kbKey, (old) => (old ?? []).map((x) => (x.id === id ? mapper(x) : x)))
    return () => { if (prev) qc.setQueryData(kbKey, prev) }
  }

  // ── Comment mutations (mock today, REST endpoints once the backend exists) ──
  const addCommentMutation = useMutation({
    mutationFn: ({ id, body, parentId }: { id: string; body: string; parentId: string | null }) =>
      dp.addKBComment(id, {
        author_id: session.userId,
        author_name: currentUser?.name ?? session.userId,
        author_role: session.role,
        body,
        parent_id: parentId,
      }),
    onMutate: async ({ id, body, parentId }) => {
      await qc.cancelQueries({ queryKey: ['kb'] })
      const optimistic = buildOptimisticComment(session.userId, currentUser?.name ?? session.userId, session.role, body, parentId)
      return { rollback: optimisticPatchArticle(id, (a) => ({ ...a, comments: [...(a.comments ?? []), optimistic] })) }
    },
    onError: (_e, _v, ctx) => { ctx?.rollback(); toast({ title: "Couldn't post the comment", variant: 'destructive' }) },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['kb'] }) },
  })

  const reactCommentMutation = useMutation({
    mutationFn: ({ id, commentId, reaction }: { id: string; commentId: string; reaction: 'like' | 'dislike' }) =>
      dp.toggleKBCommentReaction(id, commentId, session.userId, reaction),
    onMutate: async ({ id, commentId, reaction }) => {
      await qc.cancelQueries({ queryKey: ['kb'] })
      return { rollback: optimisticPatchArticle(id, (a) => ({ ...a, comments: applyCommentReaction(a.comments ?? [], commentId, session.userId, reaction) })) }
    },
    onError: (_e, _v, ctx) => { ctx?.rollback(); toast({ title: "Couldn't save your reaction", variant: 'destructive' }) },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['kb'] }) },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: ({ id, commentId }: { id: string; commentId: string }) => dp.deleteKBComment(id, commentId),
    onMutate: async ({ id, commentId }) => {
      await qc.cancelQueries({ queryKey: ['kb'] })
      return { rollback: optimisticPatchArticle(id, (a) => ({ ...a, comments: removeCommentAndDescendants(a.comments ?? [], commentId) })) }
    },
    onError: (_e, _v, ctx) => { ctx?.rollback(); toast({ title: "Couldn't delete the comment", variant: 'destructive' }) },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['kb'] }) },
  })

  // Submit an article for review (any user). Goes to status 'pending', not public.
  const submitMutation = useMutation({
    mutationFn: () =>
      dp.submitKBArticle({
        title: form.title.trim(),
        body: form.body.trim(),
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        author_id: session.userId,
        author_name: currentUser?.name ?? session.userId,
        author_role: session.role,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb'] })
      setShowCreate(false)
      setForm({ title: '', body: '', tags: '' })
      setBanner({ kind: 'success', message: 'Your article has been submitted for review.' })
    },
    // Keep the user's entered data intact on failure (dialog stays open).
    onError: () => setBanner({ kind: 'error', message: "Couldn't submit your article. Please try again." }),
  })

  // Technical-Head-only: approve a pending article → published (public).
  const publishMutation = useMutation({
    mutationFn: (id: string) => dp.publishKBArticle(id, scope),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb'] })
      setSelected(null)
      setBanner({ kind: 'success', message: 'Article published successfully.' })
    },
    onError: () => setBanner({ kind: 'error', message: "Couldn't publish the article. Please try again." }),
  })

  // Technical-Head-only: reject/send back a pending article with an optional reason.
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => dp.rejectKBArticle(id, scope, reason || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb'] })
      setRejecting(null)
      setRejectReason('')
      setBanner({ kind: 'success', message: 'Article sent back to the author.' })
    },
    onError: () => setBanner({ kind: 'error', message: "Couldn't reject the article. Please try again." }),
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">{visibleArticles.length} articles</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <PlusCircle className="h-4 w-4" /> Submit Article
        </Button>
      </div>

      {/* Result banner */}
      {banner && (
        <div
          role="status"
          className={cn(
            'flex items-start gap-2 rounded-lg border p-3 text-sm',
            banner.kind === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
              : 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300'
          )}
        >
          {banner.kind === 'success' ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{banner.message}</span>
          <button type="button" onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Technical Head review area */}
      {isTH && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            <h2 className="font-semibold text-amber-900 dark:text-amber-200">Review Queue</h2>
            {(pendingArticles ?? []).length > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-amber-600 text-white text-xs font-semibold h-5 min-w-5 px-1.5">
                {(pendingArticles ?? []).length}
              </span>
            )}
          </div>

          {(pendingArticles ?? []).length === 0 ? (
            <p className="text-sm text-amber-800/80 dark:text-amber-300/80">No articles awaiting review.</p>
          ) : (
            <div className="space-y-3">
              {(pendingArticles ?? []).map((a: KBArticle) => (
                <div key={a.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLOR.pending}`}>pending</span>
                    {a.tags.slice(0, 3).map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                  </div>
                  <h3 className="font-semibold text-foreground">{a.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap break-words">{a.body}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-2">
                    <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" /> {a.author_name ?? a.author_id}</span>
                    {a.author_role && <span className="rounded bg-muted px-1.5 py-0.5">{ROLE_LABELS[a.author_role] ?? a.author_role}</span>}
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(a.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Button variant="outline" size="sm" onClick={() => setSelected(a)}>
                      <Eye className="h-3.5 w-3.5" /> Review
                    </Button>
                    <Button size="sm" disabled={publishMutation.isPending} onClick={() => publishMutation.mutate(a.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Publish
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setRejecting(a); setRejectReason('') }}>
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search articles..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : visibleArticles.length === 0 ? (
        <EmptyState icon={BookOpen} title="No articles found" description={search ? 'Try different keywords.' : 'No published articles yet.'} />
      ) : (
        <div className="space-y-3">
          {visibleArticles.map((a: KBArticle) => (
            <div
              key={a.id}
              className="rounded-xl border bg-card p-4 hover:shadow-sm hover:border-primary/40 transition-all cursor-pointer"
              onClick={() => router.push(`/knowledge-base/${slugify(a.title)}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[a.status]}`}>
                      {a.status}
                    </span>
                    {a.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                  <h3 className="font-semibold text-foreground">{a.title}</h3>
                  {a.status === 'rejected' && a.author_id === session.userId && a.rejection_reason && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Sent back: {a.rejection_reason}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.published_at ? `Published ${formatDate(a.published_at)}` : `Updated ${formatDate(a.updated_at)}`}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    aria-label="Comments"
                    onClick={(e) => { e.stopPropagation(); setCommentingId(a.id) }}
                  >
                    <MessageCircle className="h-4 w-4" /> {(a.comments ?? []).length}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    aria-label="View"
                    onClick={(e) => { e.stopPropagation(); setSelected(a) }}
                  >
                    <Eye className="h-4 w-4" /> View
                  </Button>
                  {canEditArticle(a) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      aria-label="Edit"
                      onClick={(e) => { e.stopPropagation(); openEdit(a) }}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  )}
                  {canEditArticle(a) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      aria-label="Delete"
                      onClick={(e) => { e.stopPropagation(); setDeleting(a) }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-1.5 flex-wrap mb-2 items-center">
            {selected && (
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[selected.status]}`}>{selected.status}</span>
            )}
            {selected?.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
          </div>
          <pre className="text-sm whitespace-pre-wrap font-sans text-foreground leading-relaxed">{selected?.body}</pre>
          {isTH && selected?.status === 'pending' && (
            <DialogFooter className="mt-2">
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => { setRejecting(selected); setRejectReason(''); setSelected(null) }}
              >
                <XCircle className="h-4 w-4" /> Reject
              </Button>
              <Button disabled={publishMutation.isPending} onClick={() => publishMutation.mutate(selected.id)}>
                <CheckCircle2 className="h-4 w-4" /> {publishMutation.isPending ? 'Publishing...' : 'Publish'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Comments Dialog */}
      {commenting && (
        <Dialog open={!!commenting} onOpenChange={(o) => !o && setCommentingId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Comments · {commenting.title}</DialogTitle></DialogHeader>
            <CommentThread
              comments={commenting.comments ?? []}
              currentUserId={session.userId}
              onAddComment={(body, parentId) => addCommentMutation.mutate({ id: commenting.id, body, parentId })}
              onReact={(commentId, reaction) => reactCommentMutation.mutate({ id: commenting.id, commentId, reaction })}
              onDelete={(commentId) => deleteCommentMutation.mutate({ id: commenting.id, commentId })}
              busyAdd={addCommentMutation.isPending}
              busyReact={reactCommentMutation.isPending}
              busyDelete={deleteCommentMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Dialog */}
      {editing && (
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Edit Article</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Article title" />
              </div>
              <div className="space-y-1.5">
                <Label>Content (Markdown supported)</Label>
                <Textarea value={editForm.body} onChange={(e) => setEditForm({ ...editForm, body: e.target.value })} rows={8} placeholder="Write your article..." />
              </div>
              <div className="space-y-1.5">
                <Label>Tags (comma-separated)</Label>
                <Input value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} placeholder="erp, integration, api" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as KBArticle['status'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button disabled={editMutation.isPending || !editForm.title.trim()} onClick={() => editMutation.mutate()}>
                {editMutation.isPending ? 'Submitting...' : 'Submit for Review'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation */}
      {deleting && (
        <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete article?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will permanently delete <span className="font-medium text-foreground">{deleting.title}</span>. This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleting.id)}>
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reject confirmation (Technical Head) */}
      {rejecting && (
        <Dialog open={!!rejecting} onOpenChange={(o) => { if (!o) { setRejecting(null); setRejectReason('') } }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Reject article?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Send <span className="font-medium text-foreground">{rejecting.title}</span> back to the author. Optionally include a reason.
            </p>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="What needs to change before this can be published?" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRejecting(null); setRejectReason('') }}>Cancel</Button>
              <Button variant="destructive" disabled={rejectMutation.isPending} onClick={() => rejectMutation.mutate({ id: rejecting.id, reason: rejectReason })}>
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Submit Dialog (any user) */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Submit Article for Review</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Your article will be sent to the Technical Head for review before it appears publicly.
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Article title" />
            </div>
            <div className="space-y-1.5">
              <Label>Content (Markdown supported)</Label>
              <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={8} placeholder="Write your article..." />
            </div>
            <div className="space-y-1.5">
              <Label>Tags (comma-separated)</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="erp, integration, api" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={submitMutation.isPending || !form.title.trim() || !form.body.trim()} onClick={() => submitMutation.mutate()}>
              {submitMutation.isPending ? 'Submitting...' : 'Submit for Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}