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
import { Lightbulb, PlusCircle, Pencil, Eye, User as UserIcon, Calendar, CheckCircle2, XCircle, X, ThumbsUp, ThumbsDown, MessageCircle, Trash2, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Solution, SolutionComment } from '@/types'

const ALL_TAB = 'all'

type Banner = { kind: 'success' | 'error'; message: string }

// Fallback Type options, unioned with categories already present in the data.
const DEFAULT_TYPES = ['Integration', 'Data & Analytics', 'CRM', 'Operations', 'HR']

// Module-scope so the impure id/timestamp generation isn't evaluated during render.
function buildComment(authorId: string, authorName: string, body: string): SolutionComment {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    author_id: authorId,
    author_name: authorName,
    body: body.trim(),
    created_at: new Date().toISOString(),
  }
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

  // Optimistically patch a single solution in the cache; returns the previous
  // snapshot so the change can be rolled back if the request fails.
  function patchSolutionInCache(id: string, patch: Partial<Solution>) {
    const prev = qc.getQueryData<Solution[]>(['solutions'])
    qc.setQueryData<Solution[]>(['solutions'], (old) =>
      (old ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)))
    return prev
  }

  // Like / dislike — persisted via updateSolution, with optimistic UI + rollback
  const reactMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Solution> }) => dp.updateSolution(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ['solutions'] })
      return { prev: patchSolutionInCache(id, patch) }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['solutions'], ctx.prev)
      setBanner({ kind: 'error', message: "Couldn't save your reaction. Please try again." })
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['solutions'] }) },
  })

  const commentMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: SolutionComment[] }) => dp.updateSolution(id, { comments }),
    onMutate: async ({ id, comments }) => {
      await qc.cancelQueries({ queryKey: ['solutions'] })
      return { prev: patchSolutionInCache(id, { comments }) }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['solutions'], ctx.prev)
      setBanner({ kind: 'error', message: "Couldn't post the comment. Please try again." })
    },
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

  function toggleLike(s: Solution) {
    const uid = session.userId
    const likes = new Set(s.likes ?? [])
    const dislikes = new Set(s.dislikes ?? [])
    if (likes.has(uid)) { likes.delete(uid) } else { likes.add(uid); dislikes.delete(uid) }
    reactMutation.mutate({ id: s.id, patch: { likes: [...likes], dislikes: [...dislikes] } })
  }

  function toggleDislike(s: Solution) {
    const uid = session.userId
    const likes = new Set(s.likes ?? [])
    const dislikes = new Set(s.dislikes ?? [])
    if (dislikes.has(uid)) { dislikes.delete(uid) } else { dislikes.add(uid); likes.delete(uid) }
    reactMutation.mutate({ id: s.id, patch: { likes: [...likes], dislikes: [...dislikes] } })
  }

  function postComment() {
    if (!commenting || !commentText.trim()) return
    const comment = buildComment(session.userId, currentUser?.name ?? session.userId, commentText)
    commentMutation.mutate({ id: commenting.id, comments: [...(commenting.comments ?? []), comment] })
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
                            className={cn('gap-1.5 px-2', (s.likes ?? []).includes(session.userId) && 'text-primary')}
                            onClick={() => toggleLike(s)}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" /> {(s.likes ?? []).length}
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className={cn('gap-1.5 px-2', (s.dislikes ?? []).includes(session.userId) && 'text-destructive')}
                            onClick={() => toggleDislike(s)}
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
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Comments · {commenting.name}</DialogTitle></DialogHeader>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              {(commenting.comments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment.</p>
              ) : (
                (commenting.comments ?? []).map((c: SolutionComment) => (
                  <div key={c.id} className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <UserIcon className="h-3 w-3" />
                      <span className="font-medium text-foreground">{c.author_name}</span>
                      <span>·</span>
                      <span>{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm break-words whitespace-pre-wrap">{c.body}</p>
                  </div>
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