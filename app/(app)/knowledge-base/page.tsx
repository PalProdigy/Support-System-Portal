'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/empty-state'
import { KBStatusBadge } from '@/modules/kb/status-badge'
import { canReviewKB, canWriteKB, KB_CATEGORIES } from '@/modules/kb/constants'
import { estimateReadingTimeMinutes, slugify } from '@/lib/markdown/utils'
import { cn, formatDate } from '@/lib/utils'
import {
  BookOpen, ClipboardList, Clock, FolderOpen, MessageCircle, PenLine, PlusCircle,
  Search, Tag, User as UserIcon, X,
} from 'lucide-react'
import type { KBArticle } from '@/types'

type Shelf = 'browse' | 'mine' | 'review'

/**
 * Knowledge Base home: documentation-portal browsing experience — hero search,
 * category chips, tag filters and a card grid. Staff get a New Article button
 * and a "My Articles" shelf; reviewers (TL/TH) also get the Review Queue.
 * Clients see published articles only (enforced by the data layer).
 */
function KnowledgeBaseIndex() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const searchParams = useSearchParams()
  const scope = { userId: session.userId, role: session.role }

  const [search, setSearch] = useState('')
  const [shelf, setShelf] = useState<Shelf>('browse')
  const category = searchParams.get('category')
  const tag = searchParams.get('tag')

  const writer = canWriteKB(session.role)
  const reviewer = canReviewKB(session.role)

  const { data: articles, isLoading } = useQuery({
    queryKey: ['kb', 'index', session.userId, search],
    queryFn: () => dp.listKBArticles({ search: search || undefined }, scope),
  })

  const all = useMemo(() => articles ?? [], [articles])
  const publishedAll = useMemo(() => all.filter((a) => a.status === 'published'), [all])
  const mine = useMemo(() => all.filter((a) => a.author_id === session.userId), [all, session.userId])
  const reviewQueue = useMemo(() => all.filter((a) => a.status === 'in_review'), [all])

  const shelfArticles = shelf === 'mine' ? mine : shelf === 'review' ? reviewQueue : publishedAll

  // Category chips: the curated list, with live counts from the current shelf.
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of shelfArticles) if (a.category) counts.set(a.category, (counts.get(a.category) ?? 0) + 1)
    return counts
  }, [shelfArticles])

  const visible = useMemo(() => {
    let list = shelfArticles
    if (category) list = list.filter((a) => a.category === category)
    if (tag) list = list.filter((a) => a.tags.includes(tag))
    return [...list].sort((a, b) =>
      new Date(b.published_at ?? b.updated_at).getTime() - new Date(a.published_at ?? a.updated_at).getTime())
  }, [shelfArticles, category, tag])

  const setFilter = (key: 'category' | 'tag', value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value); else params.delete(key)
    router.replace(`/knowledge-base${params.size ? `?${params}` : ''}`)
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5">
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-card p-6 sm:p-8 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Knowledge Base</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Guides, troubleshooting and best practices — solve it before it becomes a ticket.
            </p>
          </div>
          {writer && (
            <Button onClick={() => router.push('/knowledge-base/new')}>
              <PlusCircle className="h-4 w-4" /> New Article
            </Button>
          )}
        </div>
        <div className="relative max-w-2xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, content, tags, category or author…"
            className="pl-10 h-11 text-base bg-background"
            aria-label="Search articles"
          />
        </div>
      </div>

      {/* ── Shelves (staff) ──────────────────────────────────────────────────── */}
      {writer && (
        <Tabs value={shelf} onValueChange={(v) => setShelf(v as Shelf)}>
          <TabsList>
            <TabsTrigger value="browse" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Browse ({publishedAll.length})</TabsTrigger>
            <TabsTrigger value="mine" className="gap-1.5"><PenLine className="h-3.5 w-3.5" /> My Articles ({mine.length})</TabsTrigger>
            {reviewer && (
              <TabsTrigger value="review" className={cn('gap-1.5', reviewQueue.length > 0 && 'text-amber-600 dark:text-amber-400')}>
                <ClipboardList className="h-3.5 w-3.5" /> Review Queue ({reviewQueue.length})
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      )}

      {/* ── Category chips + active filters ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <CategoryChip label="All" active={!category} onClick={() => setFilter('category', null)} />
        {KB_CATEGORIES.filter((c) => (categoryCounts.get(c) ?? 0) > 0).map((c) => (
          <CategoryChip
            key={c}
            label={`${c} (${categoryCounts.get(c)})`}
            active={category === c}
            onClick={() => setFilter('category', category === c ? null : c)}
          />
        ))}
        {tag && (
          <button
            type="button"
            onClick={() => setFilter('tag', null)}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium hover:bg-primary/20"
          >
            <Tag className="h-3 w-3" /> {tag} <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* ── Article grid ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={shelf === 'review' ? ClipboardList : BookOpen}
          title={shelf === 'review' ? 'Nothing to review' : 'No articles found'}
          description={
            search || category || tag
              ? 'Try different keywords or clear the filters.'
              : shelf === 'mine'
                ? 'Write your first article — click "New Article" to get started.'
                : shelf === 'review'
                  ? 'Submitted articles will appear here for approval.'
                  : 'No published articles yet.'
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((a) => (
            <ArticleCard key={a.id} article={a} showStatus={shelf !== 'browse'} onTag={(t) => setFilter('tag', t)} />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground hover:border-primary/40',
      )}
    >
      {label}
    </button>
  )
}

function ArticleCard({ article: a, showStatus, onTag }: {
  article: KBArticle
  showStatus: boolean
  onTag: (tag: string) => void
}) {
  const href = `/knowledge-base/${a.slug ?? slugify(a.title)}`
  return (
    <div className="group relative rounded-xl border bg-card p-4 flex flex-col gap-2 hover:shadow-sm hover:border-primary/40 transition-all">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {a.category && (
          <span className="inline-flex items-center gap-1 font-medium text-primary">
            <FolderOpen className="h-3 w-3" /> {a.category}
          </span>
        )}
        {showStatus && <KBStatusBadge status={a.status} />}
      </div>
      <Link href={href} className="focus-visible:outline-none">
        {/* stretched link — whole card is clickable */}
        <span className="absolute inset-0" aria-hidden />
        <h3 className="font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">{a.title}</h3>
      </Link>
      {a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
      {a.tags.length > 0 && (
        <div className="relative flex items-center gap-1.5 flex-wrap">
          {a.tags.slice(0, 4).map((t) => (
            <button key={t} type="button" onClick={() => onTag(t)} className="relative z-10">
              <Badge variant="secondary" className="text-[11px] hover:bg-secondary/70 cursor-pointer">{t}</Badge>
            </button>
          ))}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" /> {a.author_name ?? a.author_id}</span>
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {estimateReadingTimeMinutes(a.body)} min read</span>
        <span>{a.published_at ? formatDate(a.published_at) : `Updated ${formatDate(a.updated_at)}`}</span>
        {(a.comments ?? []).length > 0 && (
          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {(a.comments ?? []).length}</span>
        )}
      </div>
    </div>
  )
}

export default function KnowledgeBasePage() {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-40 rounded-2xl" /></div>}>
      <KnowledgeBaseIndex />
    </Suspense>
  )
}
