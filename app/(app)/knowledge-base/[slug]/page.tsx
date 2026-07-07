'use client'

import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { MarkdownViewer } from '@/components/markdown/markdown-viewer'
import { CommentThread } from '@/components/shared/comment-thread'
import { TableOfContents } from '@/modules/kb/toc'
import { VersionHistory } from '@/modules/kb/version-history'
import { KBStatusBadge } from '@/modules/kb/status-badge'
import { canReviewKB, canWriteKB, isKBAdmin } from '@/modules/kb/constants'
import { extractHeadings, estimateReadingTimeMinutes, slugify } from '@/lib/markdown/utils'
import { formatDate } from '@/lib/utils'
import {
  ArrowLeft, ArrowRight, BookOpen, Calendar, CheckCircle2, Clock, FolderOpen, History,
  MessageSquareWarning, Pencil, Printer, RotateCcw, Send, Share2, ShieldCheck, Tag,
  Trash2, User as UserIcon, XCircle, Archive, MessageCircle,
} from 'lucide-react'

/**
 * Knowledge Base article reader: documentation-grade typography (shared
 * MarkdownViewer pipeline), sticky table of contents with scroll-spy,
 * share/print, version history, previous/next + related articles, and the
 * review workflow actions for the roles that hold them.
 */
export default function KBArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [historyOpen, setHistoryOpen] = useState(false)
  const [changesOpen, setChangesOpen] = useState(false)
  const [changesNote, setChangesNote] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: articles, isLoading } = useQuery({
    queryKey: ['kb', 'reader', session.userId],
    queryFn: () => dp.listKBArticles({}, scope),
  })
  const { data: currentUser } = useQuery({ queryKey: ['user', session.userId], queryFn: () => dp.getUser(session.userId) })

  // slug match; legacy title-derived slugs keep old links working.
  const article = (articles ?? []).find((a) => a.slug === slug || slugify(a.title) === slug)

  const headings = useMemo(() => (article ? extractHeadings(article.body) : []), [article])
  const readingTime = article ? estimateReadingTimeMinutes(article.body) : 0

  // Previous / next within the published timeline; related by category + tags.
  const published = useMemo(
    () => (articles ?? [])
      .filter((a) => a.status === 'published')
      .sort((a, b) => new Date(a.published_at ?? a.created_at).getTime() - new Date(b.published_at ?? b.created_at).getTime()),
    [articles],
  )
  const pubIndex = article ? published.findIndex((a) => a.id === article.id) : -1
  const prevArticle = pubIndex > 0 ? published[pubIndex - 1] : null
  const nextArticle = pubIndex >= 0 && pubIndex < published.length - 1 ? published[pubIndex + 1] : null

  const related = useMemo(() => {
    if (!article) return []
    return published
      .filter((a) => a.id !== article.id)
      .map((a) => ({
        a,
        score:
          (a.category && a.category === article.category ? 2 : 0) +
          a.tags.filter((t) => article.tags.includes(t)).length,
      }))
      .filter((r) => r.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, 3)
      .map((r) => r.a)
  }, [article, published])

  // ── Workflow mutations ──────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['kb'] })
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }
  const mutationOpts = (title: string) => ({
    onSuccess: () => { invalidate(); toast({ title, variant: 'success' as const }) },
    onError: (e: unknown) => toast({ title: String(e), variant: 'destructive' as const }),
  })

  const submitMutation = useMutation({ mutationFn: (id: string) => dp.submitKBArticleForReview(id, scope), ...mutationOpts('Submitted for review') })
  const approveMutation = useMutation({ mutationFn: (id: string) => dp.approveKBArticle(id, scope), ...mutationOpts('Article approved') })
  const publishMutation = useMutation({ mutationFn: (id: string) => dp.publishKBArticle(id, scope), ...mutationOpts('Article published') })
  const archiveMutation = useMutation({ mutationFn: (id: string) => dp.archiveKBArticle(id, scope), ...mutationOpts('Article archived') })
  const restoreMutation = useMutation({ mutationFn: (id: string) => dp.restoreKBArticle(id, scope), ...mutationOpts('Article restored to draft') })
  const changesMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => dp.rejectKBArticle(id, scope, note || undefined),
    onSuccess: () => { invalidate(); setChangesOpen(false); setChangesNote(''); toast({ title: 'Sent back to the author', variant: 'success' }) },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => dp.deleteKBArticle(id),
    onSuccess: () => { invalidate(); toast({ title: 'Article deleted', variant: 'success' }); router.push('/knowledge-base') },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  // ── Comments ────────────────────────────────────────────────────────────────
  const addCommentMutation = useMutation({
    mutationFn: ({ body, parentId }: { body: string; parentId: string | null }) =>
      dp.addKBComment(article!.id, {
        author_id: session.userId,
        author_name: currentUser?.name ?? session.userId,
        author_role: session.role,
        body,
        parent_id: parentId,
      }),
    onSuccess: invalidate,
    onError: () => toast({ title: "Couldn't post the comment", variant: 'destructive' }),
  })
  const reactCommentMutation = useMutation({
    mutationFn: ({ commentId, reaction }: { commentId: string; reaction: 'like' | 'dislike' }) =>
      dp.toggleKBCommentReaction(article!.id, commentId, session.userId, reaction),
    onSuccess: invalidate,
  })
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => dp.deleteKBComment(article!.id, commentId),
    onSuccess: invalidate,
  })

  // ── Share / print ───────────────────────────────────────────────────────────
  async function handleShare() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: article?.title, text: article?.description, url })
        return
      }
    } catch { /* user dismissed the share sheet — fall through to copy */ }
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: 'Link copied to clipboard', variant: 'success' })
    } catch {
      toast({ title: "Couldn't copy the link", description: url, variant: 'destructive' })
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!article) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => router.push('/knowledge-base')} className="mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border bg-card p-10 text-center space-y-3">
          <BookOpen className="h-10 w-10 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold">Article not found</h2>
          <p className="text-sm text-muted-foreground">
            No article matches this URL, or you don&apos;t have access to it yet.
          </p>
          <Button variant="outline" onClick={() => router.push('/knowledge-base')}>Browse Knowledge Base</Button>
        </div>
      </div>
    )
  }

  const isAuthor = article.author_id === session.userId
  const reviewer = canReviewKB(session.role)
  const admin = isKBAdmin(session.role)
  // Any staff member can edit any article; clients stay read-only.
  const canEdit = canWriteKB(session.role)
  const canRestoreVersions = canEdit

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      {/* ── Action bar (never printed) ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.push('/knowledge-base')}>
          <ArrowLeft className="h-4 w-4" /> Knowledge Base
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-3.5 w-3.5" /> Share
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
                <History className="h-3.5 w-3.5" /> v{article.version ?? 1}
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push(`/knowledge-base/${article.slug}/edit`)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </>
          )}
          {(isAuthor || admin) && (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Workflow actions */}
          {isAuthor && ['draft', 'changes_requested'].includes(article.status) && (
            <Button size="sm" disabled={submitMutation.isPending} onClick={() => submitMutation.mutate(article.id)}>
              <Send className="h-3.5 w-3.5" /> Submit for Review
            </Button>
          )}
          {reviewer && article.status === 'in_review' && (
            <>
              <Button size="sm" variant="outline" className="text-orange-600 dark:text-orange-400" onClick={() => setChangesOpen(true)}>
                <XCircle className="h-3.5 w-3.5" /> Request Changes
              </Button>
              <Button size="sm" variant="outline" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(article.id)}>
                <ShieldCheck className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button size="sm" disabled={publishMutation.isPending} onClick={() => publishMutation.mutate(article.id)}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Publish
              </Button>
            </>
          )}
          {reviewer && article.status === 'approved' && (
            <Button size="sm" disabled={publishMutation.isPending} onClick={() => publishMutation.mutate(article.id)}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Publish
            </Button>
          )}
          {reviewer && article.status === 'published' && (
            <Button size="sm" variant="outline" disabled={archiveMutation.isPending} onClick={() => archiveMutation.mutate(article.id)}>
              <Archive className="h-3.5 w-3.5" /> Archive
            </Button>
          )}
          {admin && article.status === 'archived' && (
            <Button size="sm" variant="outline" disabled={restoreMutation.isPending} onClick={() => restoreMutation.mutate(article.id)}>
              <RotateCcw className="h-3.5 w-3.5" /> Restore
            </Button>
          )}
        </div>
      </div>

      {/* Reviewer feedback banner for the author */}
      {isAuthor && article.status === 'changes_requested' && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-orange-300 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 p-3 text-sm text-orange-900 dark:text-orange-200 print:hidden">
          <MessageSquareWarning className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            <span className="font-medium">Changes requested{article.reviewer_name ? ` by ${article.reviewer_name}` : ''}:</span>{' '}
            {article.rejection_reason || 'edit the article and resubmit.'}
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        {/* ── Main column ─────────────────────────────────────────────────────── */}
        <article className="min-w-0">
          {/* Header */}
          <header className="mb-6 space-y-3">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {article.category && (
                <Link
                  href={`/knowledge-base?category=${encodeURIComponent(article.category)}`}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline print:no-underline"
                >
                  <FolderOpen className="h-3.5 w-3.5" /> {article.category}
                </Link>
              )}
              {article.subcategory && <span className="text-muted-foreground">/ {article.subcategory}</span>}
              {article.status !== 'published' && <KBStatusBadge status={article.status} />}
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight">{article.title}</h1>
            {article.description && <p className="text-base text-muted-foreground">{article.description}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" /> {article.author_name ?? article.author_id}</span>
              {article.published_at && (
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Published {formatDate(article.published_at)}</span>
              )}
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Updated {formatDate(article.updated_at)}</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {readingTime} min read</span>
              <span className="font-mono">v{article.version ?? 1}</span>
            </div>
            {article.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {article.tags.map((t) => (
                  <Link key={t} href={`/knowledge-base?tag=${encodeURIComponent(t)}`}>
                    <Badge variant="secondary" className="text-xs gap-1 hover:bg-secondary/70">
                      <Tag className="h-2.5 w-2.5" />{t}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </header>

          {/* Content — same pipeline as the editor's live preview */}
          <div className="border-t pt-6">
            <MarkdownViewer content={article.body} />
          </div>

          {/* Previous / next (published articles) */}
          {(prevArticle || nextArticle) && (
            <nav className="mt-10 grid gap-3 sm:grid-cols-2 print:hidden" aria-label="Article navigation">
              {prevArticle ? (
                <Link href={`/knowledge-base/${prevArticle.slug}`} className="group rounded-xl border bg-card p-4 hover:border-primary/40 transition-colors">
                  <p className="flex items-center gap-1 text-xs text-muted-foreground mb-1"><ArrowLeft className="h-3 w-3" /> Previous</p>
                  <p className="text-sm font-medium group-hover:text-primary line-clamp-2">{prevArticle.title}</p>
                </Link>
              ) : <span />}
              {nextArticle && (
                <Link href={`/knowledge-base/${nextArticle.slug}`} className="group rounded-xl border bg-card p-4 text-right hover:border-primary/40 transition-colors">
                  <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground mb-1">Next <ArrowRight className="h-3 w-3" /></p>
                  <p className="text-sm font-medium group-hover:text-primary line-clamp-2">{nextArticle.title}</p>
                </Link>
              )}
            </nav>
          )}

          {/* Related articles */}
          {related.length > 0 && (
            <section className="mt-8 print:hidden">
              <h2 className="text-sm font-semibold mb-3">Related articles</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {related.map((a) => (
                  <Link key={a.id} href={`/knowledge-base/${a.slug}`} className="group rounded-xl border bg-card p-4 hover:border-primary/40 transition-colors">
                    {a.category && <p className="text-[11px] font-medium text-primary mb-1">{a.category}</p>}
                    <p className="text-sm font-medium group-hover:text-primary line-clamp-2">{a.title}</p>
                    {a.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Comments */}
          <section className="mt-8 rounded-xl border bg-card p-4 sm:p-5 print:hidden">
            <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
              <MessageCircle className="h-4 w-4" /> Comments ({(article.comments ?? []).length})
            </h2>
            <CommentThread
              comments={article.comments ?? []}
              currentUserId={session.userId}
              onAddComment={(body, parentId) => addCommentMutation.mutate({ body, parentId })}
              onReact={(commentId, reaction) => reactCommentMutation.mutate({ commentId, reaction })}
              onDelete={(commentId) => deleteCommentMutation.mutate(commentId)}
              busyAdd={addCommentMutation.isPending}
              busyReact={reactCommentMutation.isPending}
              busyDelete={deleteCommentMutation.isPending}
            />
          </section>
        </article>

        {/* ── Right rail: TOC (never printed) ─────────────────────────────────── */}
        <aside className="hidden lg:block print:hidden">
          <div className="sticky top-6 space-y-5">
            <TableOfContents headings={headings} />
          </div>
        </aside>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────────────── */}
      <VersionHistory article={article} open={historyOpen} onOpenChange={setHistoryOpen} canRestore={canRestoreVersions} />

      <Dialog open={changesOpen} onOpenChange={(o) => { setChangesOpen(o); if (!o) setChangesNote('') }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Request changes</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Send <span className="font-medium text-foreground">{article.title}</span> back to{' '}
            {article.author_name ?? 'the author'} with your feedback.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="changes-note">What needs to change?</Label>
            <Textarea id="changes-note" rows={3} value={changesNote} onChange={(e) => setChangesNote(e.target.value)} placeholder="e.g. Add a troubleshooting section for proxy environments…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangesOpen(false)}>Cancel</Button>
            <Button disabled={changesMutation.isPending} onClick={() => changesMutation.mutate({ id: article.id, note: changesNote })}>
              {changesMutation.isPending ? 'Sending…' : 'Send feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete article?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes <span className="font-medium text-foreground">{article.title}</span> and its version history. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(article.id)}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
