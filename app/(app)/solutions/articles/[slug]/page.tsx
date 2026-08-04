'use client'

import { use, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { toast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { MarkdownViewer } from '@/components/markdown/markdown-viewer'
import { estimateReadingTimeMinutes } from '@/lib/markdown/utils'
import { ROLE_LABELS } from '@/lib/rbac'
import { cn } from '@/lib/utils'
import {
  buildOptimisticComment, applyLikeToggle, applyDislikeToggle, applyCommentReaction,
  removeCommentAndDescendants, CommentNode,
} from '@/modules/solutions/solution-comments'
import {
  ArrowLeft, BookOpen, Calendar, Clock, Pencil, RefreshCw, Tag, Trash2,
  ThumbsUp, ThumbsDown, Send, MessageCircle,
} from 'lucide-react'
import type { SolutionArticle } from '@/types'

// Article reading page — renders the stored markdown through the exact same
// MarkdownViewer pipeline the editor preview uses. Nothing but markdown is
// ever fetched or stored.
export default function SolutionArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const qc = useQueryClient()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [commentText, setCommentText] = useState('')

  const { data: article, isLoading } = useQuery({
    queryKey: ['solution-article', slug],
    queryFn: () => dp.getSolutionArticleBySlug(slug),
  })
  const { data: currentUser } = useQuery({ queryKey: ['user', session.userId], queryFn: () => dp.getUser(session.userId) })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dp.deleteSolutionArticle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solution-articles'] })
      toast({ title: 'Article deleted', variant: 'success' })
      router.push('/solutions')
    },
    onError: () => toast({ title: "Couldn't delete the article", variant: 'destructive' }),
  })

  function optimisticPatch(mapper: (a: SolutionArticle) => SolutionArticle) {
    const prev = qc.getQueryData<SolutionArticle>(['solution-article', slug])
    qc.setQueryData<SolutionArticle>(['solution-article', slug], (old) => (old ? mapper(old) : old))
    return () => { if (prev) qc.setQueryData(['solution-article', slug], prev) }
  }

  const likeMutation = useMutation({
    mutationFn: () => dp.toggleSolutionArticleLike(article!.id, session.userId),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['solution-article', slug] })
      return { rollback: optimisticPatch((a) => ({ ...a, ...applyLikeToggle(a, session.userId) })) }
    },
    onError: (_e, _v, ctx) => { ctx?.rollback(); toast({ title: "Couldn't save your reaction", variant: 'destructive' }) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['solution-article', slug] }),
  })

  const dislikeMutation = useMutation({
    mutationFn: () => dp.toggleSolutionArticleDislike(article!.id, session.userId),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['solution-article', slug] })
      return { rollback: optimisticPatch((a) => ({ ...a, ...applyDislikeToggle(a, session.userId) })) }
    },
    onError: (_e, _v, ctx) => { ctx?.rollback(); toast({ title: "Couldn't save your reaction", variant: 'destructive' }) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['solution-article', slug] }),
  })

  const commentMutation = useMutation({
    mutationFn: ({ body, parentId }: { body: string; parentId: string | null }) =>
      dp.addSolutionArticleComment(article!.id, {
        author_id: session.userId,
        author_name: currentUser?.name ?? session.userId,
        author_role: session.role,
        body,
        parent_id: parentId,
      }),
    onMutate: async ({ body, parentId }) => {
      await qc.cancelQueries({ queryKey: ['solution-article', slug] })
      const optimistic = buildOptimisticComment(session.userId, currentUser?.name ?? session.userId, session.role, body, parentId)
      return { rollback: optimisticPatch((a) => ({ ...a, comments: [...(a.comments ?? []), optimistic] })) }
    },
    onSuccess: (_data, vars) => { if (vars.parentId === null) setCommentText('') },
    onError: (_e, _v, ctx) => { ctx?.rollback(); toast({ title: "Couldn't post the comment", variant: 'destructive' }) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['solution-article', slug] }),
  })

  const commentReactionMutation = useMutation({
    mutationFn: ({ commentId, reaction }: { commentId: string; reaction: 'like' | 'dislike' }) =>
      dp.toggleSolutionArticleCommentReaction(article!.id, commentId, session.userId, reaction),
    onMutate: async ({ commentId, reaction }) => {
      await qc.cancelQueries({ queryKey: ['solution-article', slug] })
      return { rollback: optimisticPatch((a) => ({ ...a, comments: applyCommentReaction(a.comments ?? [], commentId, session.userId, reaction) })) }
    },
    onError: (_e, _v, ctx) => { ctx?.rollback(); toast({ title: "Couldn't save your reaction", variant: 'destructive' }) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['solution-article', slug] }),
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => dp.deleteSolutionArticleComment(article!.id, commentId),
    onMutate: async (commentId) => {
      await qc.cancelQueries({ queryKey: ['solution-article', slug] })
      return { rollback: optimisticPatch((a) => ({ ...a, comments: removeCommentAndDescendants(a.comments ?? [], commentId) })) }
    },
    onError: (_e, _v, ctx) => { ctx?.rollback(); toast({ title: "Couldn't delete the comment", variant: 'destructive' }) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['solution-article', slug] }),
  })

  function postComment() {
    if (!commentText.trim()) return
    commentMutation.mutate({ body: commentText, parentId: null })
  }

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <Skeleton className="h-8 w-28" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border bg-card p-10 text-center space-y-3">
          <div className="rounded-full bg-muted p-3 w-fit mx-auto">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">Article not found</h2>
          <p className="text-sm text-muted-foreground">This article may have been removed.</p>
          <Button variant="outline" onClick={() => router.push('/solutions')}>Back to Solutions</Button>
        </div>
      </div>
    )
  }

  const isAuthor = article.created_by === session.userId
  const readingTime = estimateReadingTimeMinutes(article.content)
  const wasUpdated = article.updated_at !== article.created_at

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back to Solutions
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Main column */}
        <div className="min-w-0 space-y-5">
          {/* Hero header */}
          <header className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-8 space-y-4">
            <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />

            <div className="relative flex items-center gap-2 flex-wrap">
              {article.category && <Badge className="text-xs">{article.category}</Badge>}
              {article.tags.map((t) => (
                <Badge key={t} variant="secondary" className="text-xs gap-1">
                  <Tag className="h-2.5 w-2.5" />{t}
                </Badge>
              ))}
            </div>

            <h1 className="relative text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-foreground">
              {article.title}
            </h1>
            {article.description && (
              <p className="relative text-base sm:text-lg text-muted-foreground max-w-3xl">{article.description}</p>
            )}
          </header>

          {/* Cover */}
          {article.cover_image_url && (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded image, dimensions unknown
            <img
              src={article.cover_image_url}
              alt={article.title}
              className="w-full max-h-96 rounded-xl border object-cover"
            />
          )}

          {/* Body — markdown rendered dynamically, same pipeline as the editor preview */}
          <article className="rounded-xl border bg-card p-5 sm:p-8">
            <MarkdownViewer content={article.content} />
          </article>
        </div>

        {/* Side column */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
          {isAuthor && (
            <div className="rounded-xl border bg-card p-4 space-y-2">
              <Button className="w-full" variant="outline" size="sm" onClick={() => router.push(`/solutions/articles/${article.slug}/edit`)}>
                <Pencil className="h-3.5 w-3.5" /> Edit Article
              </Button>
              <Button
                className="w-full text-destructive hover:text-destructive" variant="outline" size="sm"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Article
              </Button>
            </div>
          )}

          <div className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4 space-y-2.5">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Written By</h3>
            <div className="flex items-center gap-2.5">
              <UserAvatar name={article.created_by_name ?? 'Unknown'} userId={article.created_by} size="md" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{article.created_by_name ?? 'Unknown'}</p>
                {article.created_by_role && (
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[article.created_by_role] ?? article.created_by_role}</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4 space-y-2.5">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>Published {new Date(article.created_at).toLocaleDateString()}</span>
              </div>
              {wasUpdated && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                  <span>Updated {new Date(article.updated_at).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>{readingTime} min read</span>
              </div>
            </div>
          </div>

          {/* Reactions */}
          <div className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4 space-y-2.5">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Reactions</h3>
            <div className="flex items-center gap-1 -ml-2">
              <Button
                variant="ghost" size="sm"
                disabled={likeMutation.isPending}
                className={cn('gap-1.5 px-2', (article.likes ?? []).includes(session.userId) && 'text-primary')}
                onClick={() => likeMutation.mutate()}
              >
                <ThumbsUp className="h-3.5 w-3.5" /> {(article.likes ?? []).length}
              </Button>
              <Button
                variant="ghost" size="sm"
                disabled={dislikeMutation.isPending}
                className={cn('gap-1.5 px-2', (article.dislikes ?? []).includes(session.userId) && 'text-destructive')}
                onClick={() => dislikeMutation.mutate()}
              >
                <ThumbsDown className="h-3.5 w-3.5" /> {(article.dislikes ?? []).length}
              </Button>
              <span className="flex items-center gap-1.5 px-2 text-sm text-muted-foreground">
                <MessageCircle className="h-3.5 w-3.5" /> {(article.comments ?? []).length}
              </span>
            </div>
          </div>

          {/* Comments */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Comments {(article.comments ?? []).length > 0 && `(${(article.comments ?? []).length})`}
            </h3>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-0.5">
              {(article.comments ?? []).filter((c) => (c.parent_id ?? null) === null).length === 0 ? (
                <p className="text-xs text-muted-foreground">No comments yet. Be the first to comment.</p>
              ) : (
                (article.comments ?? [])
                  .filter((c) => (c.parent_id ?? null) === null)
                  .map((c) => (
                    <CommentNode
                      key={c.id}
                      comment={c}
                      allComments={article.comments ?? []}
                      depth={0}
                      currentUserId={session.userId}
                      onReact={(commentId, reaction) => commentReactionMutation.mutate({ commentId, reaction })}
                      onReply={(parentId, body) => commentMutation.mutate({ body, parentId })}
                      onDelete={(commentId) => deleteCommentMutation.mutate(commentId)}
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
                className="flex-1 text-sm"
              />
              <Button size="icon" disabled={commentMutation.isPending || !commentText.trim()} onClick={postComment}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {/* Delete confirmation */}
      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete article?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete <span className="font-medium text-foreground">{article.title}</span>.
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(article.id)}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
