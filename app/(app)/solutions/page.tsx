'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Lightbulb, PlusCircle, Pencil, Eye, User as UserIcon, Calendar, CheckCircle2, XCircle, X, ThumbsUp, ThumbsDown, MessageCircle, Trash2, Send, Reply, ChevronDown, ChevronUp, Newspaper, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLE_LABELS } from '@/lib/rbac'
import type { Solution, SolutionComment, Role } from '@/types'
import type { HashnodePostSummary } from '@/lib/hashnode'

const ALL_TAB = 'all'

type Banner = { kind: 'success' | 'error'; message: string }

// Fallback Type options, unioned with categories already present in the data.
const DEFAULT_TYPES = ['Integration', 'Data & Analytics', 'CRM', 'Operations', 'HR']

// Cap how deep replies keep indenting so very deep threads don't run off-screen.
const MAX_INDENT_DEPTH = 4

// Solution articles come from the org's Hashnode publication (headless CMS).
// The route handler proxies gql.hashnode.com and reports { configured: false }
// when no publication host is set, so the section hides itself gracefully.
async function fetchHashnodeArticles(): Promise<{ configured: boolean; posts: HashnodePostSummary[] }> {
  const res = await fetch('/api/hashnode/posts')
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? 'Failed to load solution articles')
  }
  return res.json()
}

// Module-scope so the impure id/timestamp generation isn't evaluated during render.
// The id is a temporary client id used only for optimistic rendering; the real id
// is assigned by the data provider (mock or backend) and reconciled on refetch.
function buildOptimisticComment(
  authorId: string, authorName: string, authorRole: Role, body: string, parentId: string | null,
): SolutionComment {
  return {
    id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    parent_id: parentId,
    author_id: authorId,
    author_name: authorName,
    author_role: authorRole,
    body: body.trim(),
    created_at: new Date().toISOString(),
    likes: [],
    dislikes: [],
  }
}

// Pure helpers that compute the toggled like/dislike arrays for optimistic UI.
function applyLikeToggle(s: Solution, uid: string): Partial<Solution> {
  const likes = new Set(s.likes ?? [])
  const dislikes = new Set(s.dislikes ?? [])
  if (likes.has(uid)) { likes.delete(uid) } else { likes.add(uid); dislikes.delete(uid) }
  return { likes: [...likes], dislikes: [...dislikes] }
}
function applyDislikeToggle(s: Solution, uid: string): Partial<Solution> {
  const likes = new Set(s.likes ?? [])
  const dislikes = new Set(s.dislikes ?? [])
  if (dislikes.has(uid)) { dislikes.delete(uid) } else { dislikes.add(uid); likes.delete(uid) }
  return { likes: [...likes], dislikes: [...dislikes] }
}

// Toggle a single comment's like/dislike (one active reaction per user).
function applyCommentReaction(
  comments: SolutionComment[], commentId: string, uid: string, reaction: 'like' | 'dislike',
): SolutionComment[] {
  return comments.map((c) => {
    if (c.id !== commentId) return c
    const likes = new Set(c.likes ?? [])
    const dislikes = new Set(c.dislikes ?? [])
    if (reaction === 'like') {
      if (likes.has(uid)) { likes.delete(uid) } else { likes.add(uid); dislikes.delete(uid) }
    } else {
      if (dislikes.has(uid)) { dislikes.delete(uid) } else { dislikes.add(uid); likes.delete(uid) }
    }
    return { ...c, likes: [...likes], dislikes: [...dislikes] }
  })
}

// Remove a comment and every descendant reply (matches backend cascade behaviour).
function removeCommentAndDescendants(comments: SolutionComment[], commentId: string): SolutionComment[] {
  const toRemove = new Set<string>()
  const collect = (cid: string) => {
    toRemove.add(cid)
    comments.filter((c) => (c.parent_id ?? null) === cid).forEach((child) => collect(child.id))
  }
  collect(commentId)
  return comments.filter((c) => !toRemove.has(c.id))
}

// Relative "2h ago" style timestamp. Module-scope so the impure Date.now() call
// isn't flagged as an impure-during-render violation.
function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

// Recursive comment renderer — a reply is just a comment with a parent, so it
// renders itself for each of its children, giving every level the same actions.
function CommentNode({
  comment, allComments, depth, currentUserId,
  onReact, onReply, onDelete, busyReact, busyReply, busyDelete,
}: {
  comment: SolutionComment
  allComments: SolutionComment[]
  depth: number
  currentUserId: string
  onReact: (commentId: string, reaction: 'like' | 'dislike') => void
  onReply: (parentId: string, body: string) => void
  onDelete: (commentId: string) => void
  busyReact: boolean
  busyReply: boolean
  busyDelete: boolean
}) {
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const children = allComments.filter((c) => (c.parent_id ?? null) === comment.id)
  const myReaction: 'like' | 'dislike' | null =
    (comment.likes ?? []).includes(currentUserId) ? 'like'
      : (comment.dislikes ?? []).includes(currentUserId) ? 'dislike'
        : null

  function submitReply() {
    const body = replyText.trim()
    if (!body) return
    onReply(comment.id, body)
    setReplyText('')
    setShowReply(false)
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 flex-wrap">
          <UserIcon className="h-3 w-3 shrink-0" />
          <span className="font-medium text-foreground">{comment.author_name}</span>
          {comment.author_role && (
            <span className="rounded bg-muted px-1.5 py-0.5">{ROLE_LABELS[comment.author_role] ?? comment.author_role}</span>
          )}
          <span>·</span>
          <span>{timeAgo(comment.created_at)}</span>
          {comment.author_id === currentUserId && (
            <button
              type="button"
              className="ml-auto hover:text-destructive disabled:opacity-50"
              disabled={busyDelete}
              onClick={() => onDelete(comment.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p className="text-sm break-words whitespace-pre-wrap">{comment.body}</p>

        <div className="flex items-center gap-1 mt-1 -ml-2 flex-wrap">
          <Button
            variant="ghost" size="sm" disabled={busyReact}
            className={cn('gap-1 px-2 h-7', myReaction === 'like' && 'text-primary')}
            onClick={() => onReact(comment.id, 'like')}
          >
            <ThumbsUp className="h-3 w-3" /> {(comment.likes ?? []).length}
          </Button>
          <Button
            variant="ghost" size="sm" disabled={busyReact}
            className={cn('gap-1 px-2 h-7', myReaction === 'dislike' && 'text-destructive')}
            onClick={() => onReact(comment.id, 'dislike')}
          >
            <ThumbsDown className="h-3 w-3" /> {(comment.dislikes ?? []).length}
          </Button>
          <Button variant="ghost" size="sm" className="gap-1 px-2 h-7" onClick={() => setShowReply((v) => !v)}>
            <Reply className="h-3 w-3" /> Reply
          </Button>
          {children.length > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 px-2 h-7" onClick={() => setCollapsed((v) => !v)}>
              {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
              {children.length} {children.length > 1 ? 'replies' : 'reply'}
            </Button>
          )}
        </div>

        {showReply && (
          <div className="flex items-end gap-2 mt-2">
            <Textarea
              rows={2}
              placeholder={`Reply to ${comment.author_name}...`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="flex-1"
            />
            <Button size="sm" disabled={busyReply || !replyText.trim()} onClick={submitReply}>
              <Send className="h-3 w-3" /> Reply
            </Button>
          </div>
        )}
      </div>

      {children.length > 0 && !collapsed && (
        <div className={cn('space-y-2', depth < MAX_INDENT_DEPTH ? 'ml-4 border-l pl-3' : 'pl-1')}>
          {children.map((child) => (
            <CommentNode
              key={child.id}
              comment={child}
              allComments={allComments}
              depth={depth + 1}
              currentUserId={currentUserId}
              onReact={onReact}
              onReply={onReply}
              onDelete={onDelete}
              busyReact={busyReact}
              busyReply={busyReply}
              busyDelete={busyDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function SolutionsPage() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()

  const [editing, setEditing] = useState<Solution | null>(null)
  const [viewing, setViewing] = useState<Solution | null>(null)
  const [commentingId, setCommentingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Solution | null>(null)
  const [commentText, setCommentText] = useState('')
  const [activeTab, setActiveTab] = useState(ALL_TAB)
  const [banner, setBanner] = useState<Banner | null>(null)

  // Auto-dismiss the result banner after a few seconds
  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 5000)
    return () => clearTimeout(t)
  }, [banner])

  const { data: solutions, isLoading } = useQuery({ queryKey: ['solutions'], queryFn: () => dp.listSolutions() })
  const { data: currentUser } = useQuery({ queryKey: ['user', session.userId], queryFn: () => dp.getUser(session.userId) })
  const { data: articlesData, isLoading: articlesLoading, isError: articlesError } = useQuery({
    queryKey: ['hashnode-posts'],
    queryFn: fetchHashnodeArticles,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  const articles = articlesData?.posts ?? []
  // Show the CMS section unless Hashnode is explicitly unconfigured.
  const showArticles = articlesError || articlesLoading || (articlesData?.configured ?? false)

  const canAddSolution = session.role !== 'client'

  const categories = Array.from(new Set((solutions ?? []).map((s: Solution) => s.category).filter(Boolean)))
  const typeOptions = Array.from(new Set([...DEFAULT_TYPES, ...categories]))
  const filteredSolutions = (solutions ?? []).filter((s: Solution) => activeTab === ALL_TAB || s.category === activeTab)
  // Live solution behind the open comment dialog (kept in sync with the cache)
  const commenting = (solutions ?? []).find((s: Solution) => s.id === commentingId) ?? null

  const updateMutation = useMutation({
    // Original author/role/creation date are preserved (s spreads the existing
    // solution); we only refresh updated_at to record when the edit happened.
    mutationFn: (s: Solution) => dp.updateSolution(s.id, { ...s, updated_at: new Date().toISOString() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solutions'] })
      setEditing(null)
      setBanner({ kind: 'success', message: 'Solution updated successfully.' })
    },
    // Modal stays open on failure, so the user's entered data is kept intact.
    onError: () => setBanner({ kind: 'error', message: "Couldn't update the solution. Please try again." }),
  })

  // Author-only: edit + delete are visible only to the user who created the solution
  const canEditSolution = (s: Solution) => !!s.author_id && s.author_id === session.userId

  // Optimistically apply a patch to one solution in the cache; returns a rollback fn.
  function optimisticPatch(id: string, mapper: (s: Solution) => Solution) {
    const prev = qc.getQueryData<Solution[]>(['solutions'])
    qc.setQueryData<Solution[]>(['solutions'], (old) =>
      (old ?? []).map((x) => (x.id === id ? mapper(x) : x)))
    return () => { if (prev) qc.setQueryData(['solutions'], prev) }
  }

  // ── Engagement mutations ────────────────────────────────────────────────────
  // Each calls a dedicated provider method (mock today, REST endpoint once the
  // backend exists) and applies an optimistic update with rollback on failure.
  const likeMutation = useMutation({
    mutationFn: (id: string) => dp.toggleSolutionLike(id, session.userId),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['solutions'] })
      return { rollback: optimisticPatch(id, (s) => ({ ...s, ...applyLikeToggle(s, session.userId) })) }
    },
    onError: (_e, _v, ctx) => { ctx?.rollback(); setBanner({ kind: 'error', message: "Couldn't save your reaction. Please try again." }) },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['solutions'] }) },
  })

  const dislikeMutation = useMutation({
    mutationFn: (id: string) => dp.toggleSolutionDislike(id, session.userId),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['solutions'] })
      return { rollback: optimisticPatch(id, (s) => ({ ...s, ...applyDislikeToggle(s, session.userId) })) }
    },
    onError: (_e, _v, ctx) => { ctx?.rollback(); setBanner({ kind: 'error', message: "Couldn't save your reaction. Please try again." }) },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['solutions'] }) },
  })

  // Add a comment or a reply (parentId = null for a top-level comment).
  const commentMutation = useMutation({
    mutationFn: ({ id, body, parentId }: { id: string; body: string; parentId: string | null }) =>
      dp.addSolutionComment(id, {
        author_id: session.userId,
        author_name: currentUser?.name ?? session.userId,
        author_role: session.role,
        body,
        parent_id: parentId,
      }),
    onMutate: async ({ id, body, parentId }) => {
      await qc.cancelQueries({ queryKey: ['solutions'] })
      const optimistic = buildOptimisticComment(session.userId, currentUser?.name ?? session.userId, session.role, body, parentId)
      return { rollback: optimisticPatch(id, (s) => ({ ...s, comments: [...(s.comments ?? []), optimistic] })) }
    },
    onError: (_e, _v, ctx) => { ctx?.rollback(); setBanner({ kind: 'error', message: "Couldn't post the comment. Please try again." }) },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['solutions'] }) },
  })

  // Like / dislike a single comment (one active reaction per user, enforced server-side).
  const commentReactionMutation = useMutation({
    mutationFn: ({ id, commentId, reaction }: { id: string; commentId: string; reaction: 'like' | 'dislike' }) =>
      dp.toggleSolutionCommentReaction(id, commentId, session.userId, reaction),
    onMutate: async ({ id, commentId, reaction }) => {
      await qc.cancelQueries({ queryKey: ['solutions'] })
      return { rollback: optimisticPatch(id, (s) => ({ ...s, comments: applyCommentReaction(s.comments ?? [], commentId, session.userId, reaction) })) }
    },
    onError: (_e, _v, ctx) => { ctx?.rollback(); setBanner({ kind: 'error', message: "Couldn't save your reaction. Please try again." }) },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['solutions'] }) },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: ({ id, commentId }: { id: string; commentId: string }) => dp.deleteSolutionComment(id, commentId),
    onMutate: async ({ id, commentId }) => {
      await qc.cancelQueries({ queryKey: ['solutions'] })
      return { rollback: optimisticPatch(id, (s) => ({ ...s, comments: removeCommentAndDescendants(s.comments ?? [], commentId) })) }
    },
    onError: (_e, _v, ctx) => { ctx?.rollback(); setBanner({ kind: 'error', message: "Couldn't delete the comment. Please try again." }) },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['solutions'] }) },
  })

  const deleteMutation = useMutation({
    mutationFn: (s: Solution) => dp.deleteSolution(s.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solutions'] })
      setDeleting(null)
      setBanner({ kind: 'success', message: 'Solution deleted successfully.' })
    },
    onError: () => setBanner({ kind: 'error', message: "Couldn't delete the solution. Please try again." }),
  })

  function postComment() {
    if (!commenting || !commentText.trim()) return
    commentMutation.mutate({ id: commenting.id, body: commentText, parentId: null })
    setCommentText('')
  }

  return (
    <div className="p-6 space-y-4 max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Solutions</h1><p className="text-sm text-muted-foreground">{solutions?.length ?? 0} products/services</p></div>
        {canAddSolution && <Button onClick={() => router.push('/solutions/new')}><PlusCircle className="h-4 w-4" /> Add Solution</Button>}
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
          <button type="button" onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : (solutions ?? []).length === 0 ? (
        <EmptyState icon={Lightbulb} title="No solutions" />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-full min-w-0 space-y-4">
          <TabsList className="grid h-auto w-full max-w-full grid-flow-col auto-cols-fr gap-1 overflow-hidden">
            <TabsTrigger value={ALL_TAB} className="min-w-0 truncate">All</TabsTrigger>
            {categories.map((c) => (
              <TabsTrigger key={c} value={c} className="min-w-0 truncate">{c}</TabsTrigger>
            ))}
          </TabsList>

          {filteredSolutions.length === 0 ? (
            <EmptyState icon={Lightbulb} title="No solutions in this type" />
          ) : (
            <div className="space-y-3">
              {filteredSolutions.map((s: Solution) => (
                  <div key={s.id} className="rounded-xl border bg-card p-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="rounded-lg bg-primary/10 p-2.5 mt-0.5 shrink-0">
                        <Lightbulb className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-semibold truncate min-w-0">{s.name}</p>
                          {!s.is_active && (
                              <span className="text-xs text-muted-foreground shrink-0">(inactive)</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.category}</p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2 break-words">{s.description}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs mt-2">
                          <span className="flex items-center gap-1 min-w-0 rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                            <UserIcon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{s.author_name ?? 'Unknown'}</span>
                          </span>
                          <span className="flex items-center gap-1 shrink-0 rounded-full bg-amber-500/10 text-amber-950 dark:text-amber-400 px-2 py-0.5 font-medium">
                            <Calendar className="h-3 w-3" />
                            {new Date(s.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Like / Dislike / Comment */}
                        <div className="flex items-center gap-1 mt-3 -ml-2">
                          <Button
                            variant="ghost" size="sm"
                            disabled={likeMutation.isPending}
                            className={cn('gap-1.5 px-2', (s.likes ?? []).includes(session.userId) && 'text-primary')}
                            onClick={() => likeMutation.mutate(s.id)}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" /> {(s.likes ?? []).length}
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            disabled={dislikeMutation.isPending}
                            className={cn('gap-1.5 px-2', (s.dislikes ?? []).includes(session.userId) && 'text-destructive')}
                            onClick={() => dislikeMutation.mutate(s.id)}
                          >
                            <ThumbsDown className="h-3.5 w-3.5" /> {(s.dislikes ?? []).length}
                          </Button>
                          <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={() => setCommentingId(s.id)}>
                            <MessageCircle className="h-3.5 w-3.5" /> {(s.comments ?? []).length}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-stretch gap-2 shrink-0 self-center">
                      <Button variant="outline" size="sm" onClick={() => setViewing(s)}>
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      {canEditSolution(s) && (
                        <Button variant="outline" size="sm" onClick={() => setEditing({ ...s })}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      )}
                      {canEditSolution(s) && (
                        <Button
                          variant="outline" size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleting(s)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      )}
                    </div>
                  </div>
              ))}
            </div>
          )}
        </Tabs>
      )}

      {/* Solution Articles — authored on Hashnode (headless CMS), rendered here */}
      {showArticles && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-primary" /> Solution Articles
              </h2>
              <p className="text-xs text-muted-foreground">In-depth guides from our publication</p>
            </div>
          </div>

          {articlesLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : articlesError ? (
            <p className="text-sm text-muted-foreground">
              Couldn&apos;t load solution articles right now. Please try again later.
            </p>
          ) : articles.length === 0 ? (
            <EmptyState icon={Newspaper} title="No articles published yet" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => router.push(`/solutions/articles/${a.slug}`)}
                  className="group rounded-xl border bg-card text-left overflow-hidden hover:border-primary/50 hover:shadow-sm transition-all flex flex-col"
                >
                  {a.coverImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- CMS-hosted image, size unknown at build time
                    <img src={a.coverImageUrl} alt="" className="h-32 w-full object-cover" />
                  )}
                  <div className="p-4 space-y-2 flex-1 flex flex-col">
                    <p className="font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">{a.title}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{a.brief}</p>
                    {a.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {a.tags.slice(0, 3).map((t) => (
                          <span key={t.slug} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{t.name}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(a.publishedAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {a.readTimeInMinutes} min read</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit */}
      {editing && (
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Solution</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Type <span className="text-destructive">*</span></Label>
                <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Description <span className="text-destructive">*</span></Label>
                <Textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value, details: e.target.value })}
                  rows={5}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                disabled={updateMutation.isPending || !editing.name.trim() || !editing.category.trim() || !editing.description.trim()}
                onClick={() => updateMutation.mutate(editing)}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* View */}
      {viewing && (
        <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{viewing.name}</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Type</p>
                <p>{viewing.category}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Description</p>
                <p className="break-words">{viewing.description}</p>
              </div>
              {viewing.details && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Full Details</p>
                  <p className="break-words whitespace-pre-wrap">{viewing.details}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground border-t pt-3">
                <span className="flex items-center gap-1">
                  <UserIcon className="h-3 w-3" /> {viewing.author_name ?? 'Unknown'}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {new Date(viewing.created_at).toLocaleDateString()}
                </span>
                {!viewing.is_active && <span>(inactive)</span>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              {canEditSolution(viewing) && (
                <Button onClick={() => { setEditing({ ...viewing }); setViewing(null) }}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Comments */}
      {commenting && (
        <Dialog open={!!commenting} onOpenChange={(o) => { if (!o) { setCommentingId(null); setCommentText('') } }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Comments · {commenting.name}</DialogTitle></DialogHeader>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {(commenting.comments ?? []).filter((c) => (c.parent_id ?? null) === null).length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment.</p>
              ) : (
                (commenting.comments ?? [])
                  .filter((c) => (c.parent_id ?? null) === null)
                  .map((c: SolutionComment) => (
                    <CommentNode
                      key={c.id}
                      comment={c}
                      allComments={commenting.comments ?? []}
                      depth={0}
                      currentUserId={session.userId}
                      onReact={(commentId, reaction) => commentReactionMutation.mutate({ id: commenting.id, commentId, reaction })}
                      onReply={(parentId, body) => commentMutation.mutate({ id: commenting.id, body, parentId })}
                      onDelete={(commentId) => deleteCommentMutation.mutate({ id: commenting.id, commentId })}
                      busyReact={commentReactionMutation.isPending}
                      busyReply={commentMutation.isPending}
                      busyDelete={deleteCommentMutation.isPending}
                    />
                  ))
              )}
            </div>

            <div className="flex items-end gap-2 border-t pt-3">
              <Textarea
                placeholder="Write a comment..."
                rows={2}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1"
              />
              <Button
                disabled={commentMutation.isPending || !commentText.trim()}
                onClick={postComment}
              >
                <Send className="h-3.5 w-3.5" /> {commentMutation.isPending ? 'Posting...' : 'Post'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation */}
      {deleting && (
        <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete solution?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will permanently delete <span className="font-medium text-foreground">{deleting.name}</span>. This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleting)}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}