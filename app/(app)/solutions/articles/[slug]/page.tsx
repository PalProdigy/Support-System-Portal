'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, BookOpen, Calendar, Clock, ExternalLink, Tag, User as UserIcon } from 'lucide-react'
import type { HashnodePostDetail } from '@/lib/hashnode'

async function fetchArticle(slug: string): Promise<HashnodePostDetail> {
  const res = await fetch(`/api/hashnode/posts/${encodeURIComponent(slug)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? 'Failed to load the article')
  }
  const body = await res.json()
  return body.post
}

// Styles Hashnode's rendered HTML (headings, lists, code, images, tables)
// via descendant selectors — the markup comes from the CMS, not our components.
const ARTICLE_HTML_CLASSES = [
  'text-sm leading-relaxed text-foreground/90 break-words',
  '[&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-6 [&_h1]:mb-3',
  '[&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:pb-1 [&_h2]:border-b',
  '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-4 [&_h3]:mb-1',
  '[&_p]:my-2',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
  '[&_ul]:list-disc [&_ul]:ml-5 [&_ul]:my-3 [&_ul]:space-y-1',
  '[&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:my-3 [&_ol]:space-y-1',
  '[&_blockquote]:border-l-4 [&_blockquote]:border-amber-400 [&_blockquote]:pl-4 [&_blockquote]:py-2 [&_blockquote]:my-3 [&_blockquote]:bg-amber-50/60 dark:[&_blockquote]:bg-amber-900/10 [&_blockquote]:rounded-r-md [&_blockquote]:italic [&_blockquote]:text-foreground/80',
  '[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:text-foreground',
  '[&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_img]:rounded-lg [&_img]:my-4 [&_img]:max-w-full [&_img]:h-auto',
  '[&_table]:w-full [&_table]:my-3 [&_table]:text-xs [&_th]:border [&_th]:p-2 [&_th]:bg-muted [&_th]:text-left [&_td]:border [&_td]:p-2',
  '[&_hr]:my-6',
].join(' ')

export default function SolutionArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()

  const { data: post, isLoading, isError, error } = useQuery({
    queryKey: ['hashnode-post', slug],
    queryFn: () => fetchArticle(slug),
    staleTime: 5 * 60 * 1000,
    retry: 1,
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

  if (isError || !post) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border bg-card p-10 text-center space-y-3">
          <BookOpen className="h-10 w-10 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold">Article not found</h2>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'This article may have been unpublished or removed.'}
          </p>
          <Button variant="outline" onClick={() => router.push('/solutions')}>
            Back to Solutions
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back to Solutions
      </Button>

      {/* Header card */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        {post.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {post.tags.map((t) => (
              <Badge key={t.slug} variant="secondary" className="text-xs gap-1">
                <Tag className="h-2.5 w-2.5" />{t.name}
              </Badge>
            ))}
          </div>
        )}

        <h1 className="text-2xl font-bold text-foreground leading-tight">{post.title}</h1>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-3 border-t">
          <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" /> {post.authorName}</span>
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(post.publishedAt).toLocaleDateString()}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {post.readTimeInMinutes} min read</span>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline ml-auto"
          >
            View on Hashnode <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Cover image */}
      {post.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- CMS-hosted image, size unknown at build time
        <img src={post.coverImageUrl} alt={post.title} className="w-full rounded-xl border object-cover" />
      )}

      {/* Article body — HTML rendered by the Hashnode CMS from our own publication */}
      <div className="rounded-xl border bg-card p-5">
        <div className={ARTICLE_HTML_CLASSES} dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
      </div>
    </div>
  )
}