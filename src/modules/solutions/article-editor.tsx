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
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TagInput } from '@/components/shared/tag-input'
import { MarkdownViewer } from '@/components/markdown/markdown-viewer'
import { countWords, estimateReadingTimeMinutes, excerptFromMarkdown } from '@/lib/markdown/utils'
import { uploadImage, ALLOWED_IMAGE_TYPES } from '@/lib/uploads'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Columns2, Eye, ImagePlus, Loader2, PenLine, Send, ShieldAlert, Trash2, Clock,
} from 'lucide-react'
import type { SolutionArticle } from '@/types'

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

const DEFAULT_CATEGORIES = ['Integration', 'Data & Analytics', 'CRM', 'Operations', 'HR']

type ViewMode = 'write' | 'split' | 'preview'

const VIEW_MODES: { id: ViewMode; label: string; icon: typeof PenLine }[] = [
  { id: 'write', label: 'Write', icon: PenLine },
  { id: 'split', label: 'Split', icon: Columns2 },
  { id: 'preview', label: 'Preview', icon: Eye },
]

export interface ArticleEditorProps {
  /** Omit for a new article; pass the slug to edit an existing one. */
  slug?: string
}

/**
 * Hashnode-style writing experience: cover + title + description + tags on
 * top, markdown editor with a real-time preview beside it. The preview uses
 * the exact same MarkdownViewer as the published article page, so what you
 * see is what readers get. Only markdown is ever persisted.
 *
 * This outer component loads data and enforces guards; the form itself is a
 * separate component so its state initializes directly from the loaded
 * article (no hydration effects).
 */
export function ArticleEditor({ slug }: ArticleEditorProps) {
  const isEdit = slug !== undefined
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()

  const { data: existing, isLoading } = useQuery({
    queryKey: ['solution-article', slug],
    queryFn: () => dp.getSolutionArticleBySlug(slug!),
    enabled: isEdit,
  })

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
        message="This article may have been removed."
        onBack={() => router.push('/solutions')}
      />
    )
  }

  if (isEdit && existing && existing.created_by !== session.userId) {
    return (
      <EditorBlockedState
        title="You can't edit this article"
        message="Only the author can edit an article."
        onBack={() => router.push(`/solutions/articles/${existing.slug}`)}
      />
    )
  }

  // key ensures a fresh form if the user navigates between different articles.
  return <ArticleForm key={existing?.id ?? 'new'} article={isEdit ? existing! : undefined} />
}

function ArticleForm({ article }: { article?: SolutionArticle }) {
  const isEdit = article !== undefined
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const qc = useQueryClient()

  const { data: currentUser } = useQuery({
    queryKey: ['user', session.userId],
    queryFn: () => dp.getUser(session.userId),
  })
  const { data: allArticles } = useQuery({
    queryKey: ['solution-articles'],
    queryFn: () => dp.listSolutionArticles(),
  })

  // ── Form state (initialized straight from the article when editing) ───────
  const [title, setTitle] = useState(article?.title ?? '')
  const [description, setDescription] = useState(article?.description ?? '')
  const [category, setCategory] = useState(article?.category ?? '')
  const [tags, setTags] = useState<string[]>(article?.tags ?? [])
  const [coverUrl, setCoverUrl] = useState<string | undefined>(article?.cover_image_url)
  const [content, setContent] = useState(article?.content ?? '')
  const [view, setView] = useState<ViewMode>('split')
  const [uploadingCover, setUploadingCover] = useState(false)
  const [dirty, setDirty] = useState(false)

  const coverInputRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the borderless title/description fields (DOM-only side effect).
  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }
  useEffect(() => { autoGrow(titleRef.current) }, [title])
  useEffect(() => { autoGrow(descriptionRef.current) }, [description])

  // Warn before leaving with unsaved work (closing the tab / hard refresh).
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // The preview trails typing by one idle frame (useDeferredValue), keeping
  // keystrokes snappy in large documents; MarkdownViewer is memoized on top.
  const deferredContent = useDeferredValue(content)
  const wordCount = useMemo(() => countWords(deferredContent), [deferredContent])
  const readingTime = useMemo(() => estimateReadingTimeMinutes(deferredContent), [deferredContent])

  const categoryOptions = useMemo(() => {
    const fromData = (allArticles ?? []).map((a) => a.category).filter((c): c is string => !!c)
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromData]))
  }, [allArticles])

  const handleContentChange = useCallback((md: string) => {
    setContent(md)
    setDirty(true)
  }, [])

  // ── Cover image ────────────────────────────────────────────────────────────
  async function handleCoverFile(file: File | undefined) {
    if (!file) return
    setUploadingCover(true)
    try {
      const url = await uploadImage(file)
      setCoverUrl(url)
      setDirty(true)
    } catch (err) {
      toast({
        title: "Couldn't upload the cover image",
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setUploadingCover(false)
      if (coverInputRef.current) coverInputRef.current.value = ''
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const canSave = title.trim().length > 0 && content.trim().length > 0

  const saveMutation = useMutation({
    mutationFn: async (): Promise<SolutionArticle> => {
      const authorName = currentUser?.name ?? session.userId
      // Database stores markdown only; description falls back to an excerpt
      // derived from the content so cards always have a summary.
      const shared = {
        title: title.trim(),
        description: description.trim() || excerptFromMarkdown(content),
        content,
        category: category || undefined,
        tags,
        cover_image_url: coverUrl,
      }
      if (isEdit) {
        return dp.updateSolutionArticle(article.id, {
          ...shared,
          updated_by: session.userId,
          updated_by_name: authorName,
        })
      }
      return dp.createSolutionArticle({
        ...shared,
        status: 'published',
        created_by: session.userId,
        created_by_name: authorName,
        created_by_role: session.role,
      })
    },
    onSuccess: (saved) => {
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['solution-articles'] })
      qc.invalidateQueries({ queryKey: ['solution-article', saved.slug] })
      toast({ title: isEdit ? 'Article updated' : 'Article published', variant: 'success' })
      router.push(`/solutions/articles/${saved.slug}`)
    },
    onError: () => toast({
      title: `Couldn't ${isEdit ? 'save' : 'publish'} the article`,
      description: 'Your draft is still here — please try again.',
      variant: 'destructive',
    }),
  })

  const showEditor = view !== 'preview'
  const showPreview = view !== 'write'

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1700px] mx-auto">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <span className="text-sm font-medium text-muted-foreground hidden sm:inline">
          {isEdit ? 'Edit article' : 'New article'}
        </span>

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
            disabled={!canSave || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              : <><Send className="h-4 w-4" /> {isEdit ? 'Save changes' : 'Publish'}</>}
          </Button>
        </div>
      </div>

      {/* ── Article meta ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Cover */}
        {coverUrl ? (
          <div className="relative group">
            {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded, dimensions unknown */}
            <img src={coverUrl} alt="Article cover" className="h-48 sm:h-64 w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <Button
                variant="secondary" size="sm" disabled={uploadingCover}
                onClick={() => coverInputRef.current?.click()}
              >
                <ImagePlus className="h-3.5 w-3.5" /> Change cover
              </Button>
              <Button
                variant="secondary" size="sm"
                className="text-destructive"
                onClick={() => { setCoverUrl(undefined); setDirty(true) }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            </div>
            {uploadingCover && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>
        ) : (
          <div className="px-6 pt-5">
            <Button
              variant="outline" size="sm" disabled={uploadingCover}
              onClick={() => coverInputRef.current?.click()}
            >
              {uploadingCover
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                : <><ImagePlus className="h-3.5 w-3.5" /> Add cover</>}
            </Button>
          </div>
        )}
        <input
          ref={coverInputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          className="hidden"
          aria-label="Upload cover image"
          onChange={(e) => handleCoverFile(e.target.files?.[0])}
        />

        <div className="p-6 pt-4 space-y-3">
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
            placeholder="Add a short description — shown on article cards and search results…"
            aria-label="Article description"
            className="w-full resize-none overflow-hidden bg-transparent text-base text-muted-foreground outline-none placeholder:text-muted-foreground/50"
          />

          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => { setCategory(v); setDirty(true) }}>
                <SelectTrigger aria-label="Article category">
                  <SelectValue placeholder="Select a category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <TagInput value={tags} onChange={(t) => { setTags(t); setDirty(true) }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Editor / live preview ───────────────────────────────────────────── */}
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
                  Start typing on the left — your article renders here in real time.
                </p>
              )}
            </div>
          </div>
        )}
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
