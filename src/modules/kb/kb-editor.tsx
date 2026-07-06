'use client'

import {
  useCallback, useDeferredValue, useEffect, useMemo, useRef, useState,
} from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TagInput } from '@/components/shared/tag-input'
import { MarkdownViewer } from '@/components/markdown/markdown-viewer'
import { MarkdownGuide } from '@/components/markdown/markdown-guide'
import { countWords, estimateReadingTimeMinutes, excerptFromMarkdown } from '@/lib/markdown/utils'
import { KB_CATEGORIES, canReviewKB, canWriteKB } from './constants'
import { KBStatusBadge } from './status-badge'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Columns2, Eye, Loader2, PenLine, Save, Send, ShieldAlert, Clock, MessageSquareWarning,
} from 'lucide-react'
import type { KBArticle } from '@/types'

// MDXEditor is client-only — load it lazily so the page shell (and the
// preview pane) render immediately while the editor bundle streams in.
const MarkdownEditor = dynamic(
  () => import('@/components/markdown/markdown-editor'),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3 p-6">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    ),
  },
)

type ViewMode = 'write' | 'split' | 'preview'

const VIEW_MODES: { id: ViewMode; label: string; icon: typeof PenLine }[] = [
  { id: 'write', label: 'Write', icon: PenLine },
  { id: 'split', label: 'Split', icon: Columns2 },
  { id: 'preview', label: 'Preview', icon: Eye },
]

export interface KBEditorProps {
  /** Omit for a new article; pass the slug to edit an existing one. */
  slug?: string
}

/**
 * Full-page Knowledge Base editor: MDXEditor with a live preview that uses the
 * exact same MarkdownViewer as the published article, the markdown guide
 * alongside, and Save Draft / Submit for Review workflow actions.
 * Only markdown is ever persisted.
 */
export function KBEditor({ slug }: KBEditorProps) {
  const isEdit = slug !== undefined
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const { data: articles, isLoading } = useQuery({
    queryKey: ['kb', 'editor', session.userId],
    queryFn: () => dp.listKBArticles({}, scope),
  })
  const existing = isEdit
    ? (articles ?? []).find((a) => a.slug === slug) ?? null
    : null

  if (!canWriteKB(session.role)) {
    return (
      <EditorBlockedState
        title="Read-only access"
        message="Clients can read and search the Knowledge Base, but only staff can write articles."
        onBack={() => router.push('/knowledge-base')}
      />
    )
  }

  if (isEdit && isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  if (isEdit && !existing) {
    return (
      <EditorBlockedState
        title="Article not found"
        message="This article may have been removed or renamed."
        onBack={() => router.push('/knowledge-base')}
      />
    )
  }

  if (isEdit && existing && existing.author_id !== session.userId && !canReviewKB(session.role)) {
    return (
      <EditorBlockedState
        title="You can't edit this article"
        message="Only the author or a reviewer (Team Lead / Technical Head) can edit an article."
        onBack={() => router.push(`/knowledge-base/${existing.slug}`)}
      />
    )
  }

  // key ensures a fresh form when navigating between different articles.
  return <KBForm key={existing?.id ?? 'new'} article={existing ?? undefined} />
}

function KBForm({ article }: { article?: KBArticle }) {
  const isEdit = article !== undefined
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const { data: currentUser } = useQuery({
    queryKey: ['user', session.userId],
    queryFn: () => dp.getUser(session.userId),
  })

  // ── Form state ─────────────────────────────────────────────────────────────
  const [title, setTitle] = useState(article?.title ?? '')
  const [description, setDescription] = useState(article?.description ?? '')
  const [category, setCategory] = useState(article?.category ?? '')
  const [subcategory, setSubcategory] = useState(article?.subcategory ?? '')
  const [tags, setTags] = useState<string[]>(article?.tags ?? [])
  const [content, setContent] = useState(article?.body ?? '')
  const [view, setView] = useState<ViewMode>('split')
  const [dirty, setDirty] = useState(false)

  const titleRef = useRef<HTMLTextAreaElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the borderless title/description fields.
  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }
  useEffect(() => { autoGrow(titleRef.current) }, [title])
  useEffect(() => { autoGrow(descriptionRef.current) }, [description])

  // Warn before leaving with unsaved work.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // The preview trails typing by one idle frame; MarkdownViewer is memoized.
  const deferredContent = useDeferredValue(content)
  const wordCount = useMemo(() => countWords(deferredContent), [deferredContent])
  const readingTime = useMemo(() => estimateReadingTimeMinutes(deferredContent), [deferredContent])

  const handleContentChange = useCallback((md: string) => {
    setContent(md)
    setDirty(true)
  }, [])

  const canSave = title.trim().length > 0 && content.trim().length > 0

  const buildPatch = () => ({
    title: title.trim(),
    description: description.trim() || excerptFromMarkdown(content),
    body: content,
    category: category || undefined,
    subcategory: subcategory.trim() || undefined,
    tags,
  })

  // ── Save draft / submit for review ─────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async ({ submit }: { submit: boolean }): Promise<KBArticle> => {
      let saved: KBArticle
      if (isEdit) {
        saved = await dp.updateKBArticle(article.id, buildPatch(), scope)
      } else {
        saved = await dp.createKBArticle({
          ...buildPatch(),
          status: 'draft',
          author_id: session.userId,
          author_name: currentUser?.name ?? session.userId,
          author_role: session.role,
        })
      }
      if (submit && ['draft', 'changes_requested'].includes(saved.status)) {
        saved = await dp.submitKBArticleForReview(saved.id, scope)
      }
      return saved
    },
    onSuccess: (saved, { submit }) => {
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['kb'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast({
        title: submit ? 'Submitted for review' : isEdit ? 'Draft saved' : 'Draft created',
        description: submit ? 'Reviewers have been notified.' : `Version ${saved.version ?? 1}`,
        variant: 'success',
      })
      router.push(`/knowledge-base/${saved.slug}`)
    },
    onError: (e) => toast({
      title: "Couldn't save the article",
      description: e instanceof Error ? e.message : 'Your draft is still here — please try again.',
      variant: 'destructive',
    }),
  })

  const showEditor = view !== 'preview'
  const showPreview = view !== 'write'
  const canSubmit = !isEdit || ['draft', 'changes_requested'].includes(article.status)

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1700px] mx-auto">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <span className="text-sm font-medium text-muted-foreground hidden sm:inline">
          {isEdit ? 'Edit article' : 'New KB article'}
        </span>
        {isEdit && <KBStatusBadge status={article.status} />}

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
            <Clock className="h-3.5 w-3.5" />
            {wordCount.toLocaleString()} words · {readingTime} min read
          </span>

          {/* View mode toggle */}
          <div role="group" aria-label="Editor view mode" className="flex rounded-lg border bg-card p-0.5">
            {VIEW_MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-label={`${label} view`}
                aria-pressed={view === id}
                title={`${label} view`}
                onClick={() => setView(id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  view === id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            disabled={!canSave || saveMutation.isPending}
            onClick={() => saveMutation.mutate({ submit: false })}
          >
            <Save className="h-4 w-4" /> {isEdit ? 'Save' : 'Save Draft'}
          </Button>
          {canSubmit && (
            <Button
              disabled={!canSave || saveMutation.isPending}
              onClick={() => saveMutation.mutate({ submit: true })}
            >
              {saveMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                : <><Send className="h-4 w-4" /> Submit for Review</>}
            </Button>
          )}
        </div>
      </div>

      {/* Reviewer feedback — shown while the article needs changes */}
      {isEdit && article.status === 'changes_requested' && (
        <div className="flex items-start gap-2 rounded-lg border border-orange-300 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 p-3 text-sm text-orange-900 dark:text-orange-200">
          <MessageSquareWarning className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">
              Changes requested{article.reviewer_name ? ` by ${article.reviewer_name}` : ''}
            </p>
            <p className="text-orange-800/90 dark:text-orange-300/90">
              {article.rejection_reason || 'See the reviewer for details, then resubmit.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Article meta ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-6 space-y-3">
        <textarea
          ref={titleRef}
          rows={1}
          value={title}
          onChange={(e) => { setTitle(e.target.value.replace(/\n/g, ' ')); setDirty(true) }}
          placeholder="Article title…"
          aria-label="Article title"
          className="w-full resize-none overflow-hidden bg-transparent text-3xl font-bold leading-tight tracking-tight outline-none placeholder:text-muted-foreground/50"
        />
        <textarea
          ref={descriptionRef}
          rows={1}
          value={description}
          onChange={(e) => { setDescription(e.target.value.replace(/\n/g, ' ')); setDirty(true) }}
          placeholder="Short description — shown on cards, search results and as the meta description…"
          aria-label="Article description"
          className="w-full resize-none overflow-hidden bg-transparent text-base text-muted-foreground outline-none placeholder:text-muted-foreground/50"
        />

        <div className="grid gap-3 sm:grid-cols-3 pt-1">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setDirty(true) }}>
              <SelectTrigger aria-label="Article category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {KB_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kb-subcategory">Subcategory <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="kb-subcategory"
              value={subcategory}
              onChange={(e) => { setSubcategory(e.target.value); setDirty(true) }}
              placeholder="e.g. Agents, Payroll…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <TagInput value={tags} onChange={(t) => { setTags(t); setDirty(true) }} />
          </div>
        </div>
      </div>

      {/* ── Editor / live preview / guide ───────────────────────────────────── */}
      <div className={cn('grid gap-4 items-start', showEditor && showPreview && 'lg:grid-cols-2')}>
        {showEditor && (
          <div className="rounded-xl border bg-card overflow-hidden min-w-0">
            <MarkdownEditor
              markdown={content}
              onChange={handleContentChange}
              autoFocus={!isEdit}
            />
          </div>
        )}

        <div className={cn('min-w-0 space-y-4', !showPreview && 'lg:col-span-1')}>
          {showPreview && (
            <div className="rounded-xl border bg-card min-w-0">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" /> Live preview
                </span>
                <span className="text-[11px] text-muted-foreground">rendered exactly as published</span>
              </div>
              <div className="p-5 sm:p-6">
                {deferredContent.trim() ? (
                  <MarkdownViewer content={deferredContent} />
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Start typing — your article renders here in real time.
                  </p>
                )}
              </div>
            </div>
          )}
          {/* Markdown manual: what to type to get each feature */}
          <MarkdownGuide />
        </div>
      </div>
    </div>
  )
}

function EditorBlockedState({ title, message, onBack }: { title: string; message: string; onBack: () => void }) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="rounded-xl border bg-card p-10 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto" />
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" onClick={onBack}>Go back</Button>
      </div>
    </div>
  )
}
