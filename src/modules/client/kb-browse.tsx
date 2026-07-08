'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { EmptyState } from '@/components/shared/empty-state'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BookOpen, Search, Tag, Clock, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { KBArticle } from '@/types'

export function KBBrowse() {
  const dp = getDataProvider()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [reading, setReading] = useState<KBArticle | null>(null)

  const runSearch = () => {
    setIsSearching(true)
    setQuery(search)
    setTimeout(() => setIsSearching(false), 300)
  }

  const { data: articles, isLoading } = useQuery({
    queryKey: ['kb-articles', 'published'],
    queryFn: () => dp.listKBArticles({ status: 'published' }),
  })

  const filtered = (articles ?? []).filter((a) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      a.title.toLowerCase().includes(q) ||
      a.body.toLowerCase().includes(q) ||
      a.tags.some((t) => t.toLowerCase().includes(q))
    )
  })

  if (isLoading) return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
    </div>
  )

  return (
    <>
      <div className="space-y-4">
        <div className="flex max-w-lg items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search articles, tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
            />
          </div>
          <Button onClick={runSearch} disabled={isSearching} aria-label="Search">
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4" />Search</>}
          </Button>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={query ? 'No matching articles' : 'No articles published yet'}
            description={query ? 'Try different keywords.' : 'Check back soon for guides and documentation.'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((article) => (
              <button
                key={article.id}
                onClick={() => setReading(article)}
                className="text-left rounded-xl border bg-card p-4 hover:shadow-sm hover:bg-accent/20 transition-all space-y-2"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-1.5 shrink-0 mt-0.5">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-semibold text-sm text-foreground line-clamp-2">{article.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{article.body.replace(/#+ /g, '').slice(0, 120)}…</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap pl-10">
                  {article.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      <Tag className="h-2.5 w-2.5" />{tag}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
                    <Clock className="h-2.5 w-2.5" />{formatDate(article.updated_at)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Article reader */}
      <Dialog open={!!reading} onOpenChange={(o) => !o && setReading(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{reading?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {reading?.tags && reading.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {reading.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    <Tag className="h-3 w-3" />{tag}
                  </span>
                ))}
              </div>
            )}
            <div className="prose prose-sm max-w-none dark:prose-invert text-foreground leading-relaxed whitespace-pre-wrap">
              {reading?.body}
            </div>
            <p className="text-xs text-muted-foreground">Last updated {reading && formatDate(reading.updated_at)}</p>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setReading(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}