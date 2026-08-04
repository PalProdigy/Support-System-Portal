'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchInput } from '@/components/ui/search-input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/shared/searchable-select'
import { EmptyState } from '@/components/shared/empty-state'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Lightbulb, PlusCircle, Pencil, User as UserIcon, Calendar, CheckCircle2, XCircle, X, ThumbsUp, ThumbsDown, MessageCircle, Trash2, Send, Newspaper, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buildOptimisticComment, applyLikeToggle, applyDislikeToggle, applyCommentReaction,
  removeCommentAndDescendants, CommentNode,
} from './solution-comments'
import type { Solution, SolutionComment } from '@/types'

const ALL_TAB = 'all'
const MINE_TAB = 'mine'
const TEAM_TAB = 'team'

type Banner = { kind: 'success' | 'error'; message: string }

// Fallback Type options, unioned with categories already present in the data.
const DEFAULT_TYPES = ['Integration', 'Data & Analytics', 'CRM', 'Operations', 'HR']

export function SolutionsPage() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()

  const [editing, setEditing] = useState<Solution | null>(null)
  const [commentingId, setCommentingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Solution | null>(null)
  const [commentText, setCommentText] = useState('')
  const [activeTab, setActiveTab] = useState(ALL_TAB)
  const [productFilter, setProductFilter] = useState('all')
  const [banner, setBanner] = useState<Banner | null>(null)
  const [query, setQuery] = useState('')

  // Auto-dismiss the result banner after a few seconds
  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 5000)
    return () => clearTimeout(t)
  }, [banner])

  const { data: solutions, isLoading } = useQuery({ queryKey: ['solutions'], queryFn: () => dp.listSolutions() })
  const { data: currentUser } = useQuery({ queryKey: ['user', session.userId], queryFn: () => dp.getUser(session.userId) })
  // Solution Articles are a team lead / support engineer resource only.
  const canViewArticles = ['team_lead', 'support_engineer'].includes(session.role)

  // In-house knowledge-base articles (markdown, authored in the portal) — also
  // fetched for non-team-lead/engineer roles since every Solution links out to
  // its own article page, regardless of who can see the Team tab.
  const { data: articles, isLoading: articlesLoading } = useQuery({
    queryKey: ['solution-articles'],
    queryFn: () => dp.listSolutionArticles({ status: 'published' }),
  })
  const articleSlugBySolutionId = Object.fromEntries(
    (articles ?? []).filter((a) => a.solution_id).map((a) => [a.solution_id as string, a.slug])
  )

  const canAddSolution = session.role !== 'client'

  const mySolutionsCount = (solutions ?? []).filter((s: Solution) => s.author_id === session.userId).length
  const isArticlesTab = activeTab === TEAM_TAB
  const q = query.trim().toLowerCase()
  const matchesQuery = (name: string, description: string, category?: string) =>
    !q || name.toLowerCase().includes(q) || description.toLowerCase().includes(q) || (category ?? '').toLowerCase().includes(q)
  const displayedArticles = (articles ?? [])
    .filter((a) => matchesQuery(a.title, a.description, a.category))

  const categories = Array.from(new Set((solutions ?? []).map((s: Solution) => s.category).filter(Boolean)))
  const typeOptions = Array.from(new Set([...DEFAULT_TYPES, ...categories]))
  const filteredSolutions = (solutions ?? [])
    .filter((s: Solution) => activeTab !== MINE_TAB || s.author_id === session.userId)
    .filter((s: Solution) => productFilter === 'all' || s.category === productFilter)
    .filter((s: Solution) => matchesQuery(s.name, s.description, s.category))
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
    <div className="space-y-4 max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div><h1 className="text-2xl font-bold">Solutions</h1><p className="text-sm text-muted-foreground">{solutions?.length ?? 0} products/services</p></div>
        <div className="flex items-center gap-2">
          {!isArticlesTab && (
            <div className="w-48">
              <SearchableSelect
                icon={Package}
                options={[{ id: 'all', label: 'All Products' }, ...typeOptions.map((t) => ({ id: t, label: t }))]}
                value={productFilter}
                onChange={setProductFilter}
                placeholder="Product"
                searchPlaceholder="Search products…"
              />
            </div>
          )}
          <SearchInput
            containerClassName="w-full max-w-xs"
            placeholder={isArticlesTab ? 'Search articles...' : 'Search solutions...'}
            value={query}
            onChange={setQuery}
            aria-label={isArticlesTab ? 'Search articles' : 'Search solutions'}
            resultCount={isArticlesTab ? displayedArticles.length : filteredSolutions.length}
            resultLabel={isArticlesTab ? 'article' : 'solution'}
          />
          {canAddSolution && (
            <Button onClick={() => router.push('/solutions/new')}>
              <PlusCircle className="h-4 w-4" /> Add Solution
            </Button>
          )}
        </div>
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
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-full min-w-0 space-y-4">
          <TabsList className="grid h-auto w-full max-w-full grid-flow-col auto-cols-fr gap-1 overflow-hidden">
            <TabsTrigger value={ALL_TAB} className="w-full min-w-0 truncate">All</TabsTrigger>
            <TabsTrigger value={MINE_TAB} className="w-full min-w-0 truncate">My Solutions ({mySolutionsCount})</TabsTrigger>
            {canViewArticles && (
              <TabsTrigger value={TEAM_TAB} className="w-full min-w-0 truncate gap-1.5">
                <Newspaper className="h-3.5 w-3.5 shrink-0" /> Team
              </TabsTrigger>
            )}
          </TabsList>

          {isArticlesTab ? (
            /* Solution Articles — in-house Knowledge Base (markdown, authored in
               the portal). Team lead / support engineer resource only. */
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">In-depth guides written by our team</p>

              {articlesLoading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
              ) : displayedArticles.length === 0 ? (
                <EmptyState
                  icon={Newspaper}
                  title={query ? `No results found for "${query}"` : 'No articles published yet'}
                />
              ) : (
                <div className="space-y-2.5">
                  {displayedArticles.map((a) => (
                    <div
                      key={a.id}
                      className="group rounded-xl border bg-card p-4 flex items-start justify-between gap-3 transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                      onClick={() => router.push(`/solutions/articles/${a.slug}`)}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="rounded-lg bg-primary/10 p-2.5 mt-0.5 shrink-0">
                          <Newspaper className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <p className="font-semibold truncate min-w-0 group-hover:text-primary transition-colors">{a.title}</p>
                            {a.category && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{a.category}</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2 break-words">{a.description}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs mt-2">
                            <span className="flex items-center gap-1 min-w-0 rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                              <UserIcon className="h-3 w-3 shrink-0" />
                              <span className="truncate">{a.created_by_name ?? 'Unknown'}</span>
                            </span>
                            <span className="flex items-center gap-1 shrink-0 rounded-full bg-amber-500/10 text-amber-950 dark:text-amber-400 px-2 py-0.5 font-medium">
                              <Calendar className="h-3 w-3" />
                              {new Date(a.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (solutions ?? []).length === 0 ? (
            <EmptyState icon={Lightbulb} title="No solutions" />
          ) : filteredSolutions.length === 0 ? (
            <EmptyState icon={Lightbulb} title={query ? `No results found for "${query}"` : activeTab === MINE_TAB ? "You haven't added any solutions yet" : 'No solutions found'} />
          ) : (
            <div className="space-y-2.5">
              {filteredSolutions.map((s: Solution) => (
                  <div
                    key={s.id}
                    className="group rounded-xl border bg-card p-4 flex items-start justify-between gap-3 transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                    onClick={() => {
                      const slug = articleSlugBySolutionId[s.id]
                      if (slug) router.push(`/solutions/articles/${slug}`)
                    }}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="rounded-lg bg-primary/10 p-2.5 mt-0.5 shrink-0">
                        <Lightbulb className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <p className="font-semibold truncate min-w-0 group-hover:text-primary transition-colors">
                            {s.name}
                          </p>
                          {s.category && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{s.category}</span>
                          )}
                          {!s.is_active && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-100 shrink-0">Inactive</span>
                          )}
                        </div>
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
                            onClick={(e) => { e.stopPropagation(); likeMutation.mutate(s.id) }}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" /> {(s.likes ?? []).length}
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            disabled={dislikeMutation.isPending}
                            className={cn('gap-1.5 px-2', (s.dislikes ?? []).includes(session.userId) && 'text-destructive')}
                            onClick={(e) => { e.stopPropagation(); dislikeMutation.mutate(s.id) }}
                          >
                            <ThumbsDown className="h-3.5 w-3.5" /> {(s.dislikes ?? []).length}
                          </Button>
                          <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={(e) => { e.stopPropagation(); setCommentingId(s.id) }}>
                            <MessageCircle className="h-3.5 w-3.5" /> {(s.comments ?? []).length}
                          </Button>
                        </div>
                      </div>
                    </div>
                    {canEditSolution(s) && (
                      <div className="flex flex-col items-stretch gap-2 shrink-0 self-center">
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setEditing({ ...s }) }}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleting(s) }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    )}
                  </div>
              ))}
            </div>
          )}
        </Tabs>
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
