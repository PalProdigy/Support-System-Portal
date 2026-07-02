'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, BookOpen, Calendar, Hash, Tag } from 'lucide-react'
import type { KBArticle, Solution, Product, User } from '@/types'

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ── Inline Markdown: **bold** and `code` ─────────────────────────────────────
function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">{part.slice(1, -1)}</code>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

// ── Block Markdown renderer ───────────────────────────────────────────────────
function MarkdownBody({ content }: { content: string }) {
  const lines = content.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('# ')) {
      nodes.push(
        <h1 key={i} className="text-xl font-bold text-foreground mt-6 mb-3 first:mt-0">
          {line.slice(2)}
        </h1>
      )
    } else if (line.startsWith('## ')) {
      nodes.push(
        <h2 key={i} className="text-base font-semibold text-foreground mt-5 mb-2 pb-1 border-b">
          {line.slice(3)}
        </h2>
      )
    } else if (line.startsWith('### ')) {
      nodes.push(
        <h3 key={i} className="text-sm font-semibold text-foreground mt-4 mb-1">
          {line.slice(4)}
        </h3>
      )
    } else if (line.startsWith('> ')) {
      nodes.push(
        <blockquote key={i} className="border-l-4 border-amber-400 pl-4 py-2 my-3 bg-amber-50/60 dark:bg-amber-900/10 rounded-r-md text-sm italic text-foreground/80">
          <InlineText text={line.slice(2)} />
        </blockquote>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2))
        i++
      }
      nodes.push(
        <ul key={`ul-${i}`} className="list-disc ml-5 space-y-1 my-3 text-sm">
          {items.map((item, j) => (
            <li key={j} className="text-foreground/90 leading-relaxed"><InlineText text={item} /></li>
          ))}
        </ul>
      )
      continue
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''))
        i++
      }
      nodes.push(
        <ol key={`ol-${i}`} className="list-decimal ml-5 space-y-1 my-3 text-sm">
          {items.map((item, j) => (
            <li key={j} className="text-foreground/90 leading-relaxed"><InlineText text={item} /></li>
          ))}
        </ol>
      )
      continue
    } else if (line.trim() !== '') {
      nodes.push(
        <p key={i} className="text-sm text-foreground/90 leading-relaxed my-1.5">
          <InlineText text={line} />
        </p>
      )
    }

    i++
  }

  return <div>{nodes}</div>
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function KBArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const dp = getDataProvider()

  const { data: articles, isLoading } = useQuery({
    queryKey: ['kb'],
    queryFn: () => dp.listKBArticles(),
  })
  const { data: solutions } = useQuery({ queryKey: ['solutions'], queryFn: () => dp.listSolutions() })
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => dp.listProducts() })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })

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

  const article = (articles ?? []).find((a: KBArticle) => slugify(a.title) === slug)

  if (!article) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border bg-card p-10 text-center space-y-3">
          <BookOpen className="h-10 w-10 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold">Article not found</h2>
          <p className="text-sm text-muted-foreground">
            No article matches this URL. It may have been renamed or removed.
          </p>
          <Button variant="outline" onClick={() => router.push('/knowledge-base')}>
            Browse Knowledge Base
          </Button>
        </div>
      </div>
    )
  }

  const solutionsMap = Object.fromEntries((solutions ?? []).map((s: Solution) => [s.id, s]))
  const productsMap = Object.fromEntries((products ?? []).map((p: Product) => [p.id, p]))
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))

  const solution = article.solution_id ? solutionsMap[article.solution_id] : null
  const product = article.product_id ? productsMap[article.product_id] : null
  const author = usersMap[article.author_id]

  const statusStyle: Record<string, string> = {
    published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300',
    draft:     'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    archived:  'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back to Knowledge Base
      </Button>

      {/* Header card */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        {/* Status + tags */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ${statusStyle[article.status]}`}>
            {article.status}
          </span>
          {article.tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-xs gap-1">
              <Tag className="h-2.5 w-2.5" />{t}
            </Badge>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-foreground leading-tight">{article.title}</h1>

        {/* Article info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 pt-3 border-t">
          <InfoRow icon={<Hash className="h-3.5 w-3.5" />} label="Article ID" value={article.id.toUpperCase()} mono />
          <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Created" value={formatDate(article.created_at)} />
          <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Updated" value={formatDate(article.updated_at)} />
          {article.published_at && (
            <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Published" value={formatDate(article.published_at)} />
          )}
        </div>

        {/* Applies To */}
        {(solution || product || author) && (
          <div className="pt-3 border-t space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Applies To</p>
            {solution && <AppliesRow label="Service" value={solution.name} />}
            {product && <AppliesRow label="Product" value={product.name} />}
            {author && <AppliesRow label="Author" value={author.name} />}
          </div>
        )}
      </div>

      {/* Article body */}
      <div className="rounded-xl border bg-card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Article Content</p>
        <MarkdownBody content={article.body} />
      </div>

      {/* Contact Support */}
      <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contact Support</p>
        <p className="text-xs text-muted-foreground">If this article did not resolve your issue, contact support and provide:</p>
        <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
          <li>Article ID: <span className="font-mono font-medium text-foreground">{article.id.toUpperCase()}</span></li>
          <li>A screenshot of the issue</li>
          <li>Any error messages displayed</li>
          <li>Relevant log excerpts if available</li>
        </ul>
      </div>
    </div>
  )
}

// ── Small helper components ───────────────────────────────────────────────────
function InfoRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <span className="shrink-0">{icon}</span>
      <span className="text-xs">{label}</span>
      <span className={`ml-auto text-xs text-foreground ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function AppliesRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-xs text-muted-foreground w-16 shrink-0 pt-0.5">{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
