'use client'

import { use, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { toast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { MarkdownViewer } from '@/components/markdown/markdown-viewer'
import { estimateReadingTimeMinutes } from '@/lib/markdown/utils'
import { ROLE_LABELS } from '@/lib/rbac'
import {
  ArrowLeft, BookOpen, Calendar, Clock, Pencil, RefreshCw, Tag, Trash2, User as UserIcon,
} from 'lucide-react'

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

  const { data: article, isLoading } = useQuery({
    queryKey: ['solution-article', slug],
    queryFn: () => dp.getSolutionArticleBySlug(slug),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dp.deleteSolutionArticle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solution-articles'] })
      toast({ title: 'Article deleted', variant: 'success' })
      router.push('/solutions')
    },
    onError: () => toast({ title: "Couldn't delete the article", variant: 'destructive' }),
  })

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
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
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border bg-card p-10 text-center space-y-3">
          <BookOpen className="h-10 w-10 text-muted-foreground mx-auto" />
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
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back to Solutions
        </Button>
        {isAuthor && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push(`/solutions/articles/${article.slug}/edit`)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button
              variant="outline" size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        )}
      </div>

      {/* Header */}
      <header className="rounded-xl border bg-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {article.category && (
            <Badge className="text-xs">{article.category}</Badge>
          )}
          {article.tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-xs gap-1">
              <Tag className="h-2.5 w-2.5" />{t}
            </Badge>
          ))}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-foreground">
          {article.title}
        </h1>
        {article.description && (
          <p className="text-base text-muted-foreground">{article.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
              <UserIcon className="h-3 w-3 text-primary" />
            </span>
            <span className="font-medium text-foreground">{article.created_by_name ?? 'Unknown'}</span>
            {article.created_by_role && (
              <span className="rounded bg-muted px-1.5 py-0.5">
                {ROLE_LABELS[article.created_by_role] ?? article.created_by_role}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {new Date(article.created_at).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {readingTime} min read
          </span>
          {wasUpdated && (
            <span className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Updated {new Date(article.updated_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </header>

      {/* Cover */}
      {article.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded image, dimensions unknown
        <img
          src={article.cover_image_url}
          alt={article.title}
          className="w-full rounded-xl border object-cover"
        />
      )}

      {/* Body — markdown rendered dynamically, same pipeline as the editor preview */}
      <article className="rounded-xl border bg-card p-5 sm:p-8">
        <MarkdownViewer content={article.content} />
      </article>

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
