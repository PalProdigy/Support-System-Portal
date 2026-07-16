'use client'

import { memo } from 'react'
import Link from 'next/link'
import { BookOpen, Calendar, Clock, User as UserIcon } from 'lucide-react'
import { estimateReadingTimeMinutes } from '@/lib/markdown/utils'
import type { SolutionArticle } from '@/types'

export interface ArticleCardProps {
  article: SolutionArticle
}

/**
 * Card for a knowledge-base article on the Solutions page. Reading time is
 * computed from the markdown on the fly — it is never stored.
 */
export const ArticleCard = memo(function ArticleCard({ article }: ArticleCardProps) {
  const readingTime = estimateReadingTimeMinutes(article.content)

  return (
    <Link
      href={`/solutions/articles/${article.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {article.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded image, dimensions unknown
        <img
          src={article.cover_image_url}
          alt=""
          loading="lazy"
          className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
          <BookOpen className="h-8 w-8 text-primary/50" aria-hidden />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        {article.category && (
          <span className="w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {article.category}
          </span>
        )}
        <h3 className="font-semibold leading-snug line-clamp-2 transition-colors group-hover:text-primary">
          {article.title}
        </h3>
        <p className="flex-1 text-sm text-muted-foreground line-clamp-2">{article.description}</p>

        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {article.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 min-w-0">
            <UserIcon className="h-3 w-3 shrink-0" />
            <span className="truncate">{article.created_by_name ?? 'Unknown'}</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Calendar className="h-3 w-3" />
            {new Date(article.created_at).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Clock className="h-3 w-3" />
            {readingTime} min read
          </span>
        </div>
      </div>
    </Link>
  )
})
