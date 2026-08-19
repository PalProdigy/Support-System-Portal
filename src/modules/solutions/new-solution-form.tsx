'use client'

import { useState, useEffect, useMemo, useDeferredValue, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { MarkdownViewer } from '@/components/markdown/markdown-viewer'
import { MarkdownGuide } from '@/components/markdown/markdown-guide'
import { SearchableSelect } from '@/components/shared/searchable-select'
import { ArrowLeft, CheckCircle2, XCircle, X, Eye, Package, Ticket } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/rbac'
import { cn } from '@/lib/utils'
import type { Solution } from '@/types'

// MDXEditor is client-only — load it lazily so the page shell renders
// immediately while the editor bundle streams in.
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

type Banner = { kind: 'success' | 'error'; message: string }

// The "Create Solution" form — shared by the standalone /solutions/new route
// and the /articles?tab=solutions/new sub-state so both stay in sync instead
// of drifting as two copies. `onBack` lets each caller decide where "Back"
// returns to.
export function NewSolutionForm({ onBack }: { onBack: () => void }) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()

  const [form, setForm] = useState({ title: '', product_id: '', case_id: '', description: '' })
  const [touched, setTouched] = useState(false)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [saving, setSaving] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  // The preview trails typing by one idle frame so keystrokes stay snappy;
  // MarkdownViewer is memoized on top of that.
  const deferredDescription = useDeferredValue(form.description)
  const deferredTitle = useDeferredValue(form.title)

  // Stable callback so the editor (and its toolbar) never re-mounts on keystrokes.
  const handleDescriptionChange = useCallback((md: string) => {
    setForm((f) => ({ ...f, description: md }))
  }, [])

  const { data: currentUser } = useQuery({ queryKey: ['user', session.userId], queryFn: () => dp.getUser(session.userId) })
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => dp.listProducts() })
  const { data: casesData } = useQuery({
    queryKey: ['cases', 'for-solution', session.userId],
    queryFn: () => dp.listCases({ userId: session.userId, role: session.role }, { pageSize: 500 }),
  })

  const activeProducts = useMemo(() => (products ?? []).filter((p) => p.is_active), [products])
  const selectedProduct = activeProducts.find((p) => p.id === form.product_id)
  const cases = casesData?.items ?? []
  const selectedCase = cases.find((c) => c.id === form.case_id)

  // Auto-dismiss banner after a few seconds
  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 5000)
    return () => clearTimeout(t)
  }, [banner])

  const errors = {
    title: form.title.trim() ? '' : 'Title is required.',
    product_id: form.product_id ? '' : 'Product is required.',
    description: form.description.trim() ? '' : 'Description is required.',
  }
  const isValid = !errors.title && !errors.product_id && !errors.description

  async function handleSave() {
    setTouched(true)
    if (!isValid || saving) return

    setSaving(true)
    setBanner(null)
    try {
      const authorName = currentUser?.name ?? session.userId
      if (savedId) {
        await dp.updateSolution(savedId, {
          name: form.title.trim(),
          category: selectedProduct?.name ?? '',
          product_id: form.product_id,
          case_id: form.case_id || undefined,
          description: form.description.trim(),
          details: form.description.trim(),
          author_id: session.userId,
          author_name: authorName,
          author_role: session.role,
        })
      } else {
        const created = await dp.createSolution({
          name: form.title.trim(),
          category: selectedProduct?.name ?? '',
          product_id: form.product_id,
          case_id: form.case_id || undefined,
          description: form.description.trim(),
          details: form.description.trim(),
          is_active: true,
          author_id: session.userId,
          author_name: authorName,
          author_role: session.role,
        } as Omit<Solution, 'id' | 'created_at'>)
        setSavedId(created.id)
      }
      qc.invalidateQueries({ queryKey: ['solutions'] })
      setReadOnly(true)
      setBanner({ kind: 'success', message: 'Solution saved successfully.' })
    } catch {
      // Keep the user's entered data intact on failure
      setBanner({ kind: 'error', message: "Couldn't save the solution. Please try again." })
    } finally {
      setSaving(false)
    }
  }

  function handleEdit() {
    setReadOnly(false)
    setBanner(null)
  }

  const showError = (field: keyof typeof errors) => touched && errors[field]

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div>
        <h1 className="text-2xl font-bold">Create Solution</h1>
        <p className="text-sm text-muted-foreground">Add a new product or service to the catalogue.</p>
      </div>

      {/* Result banner */}
      {banner && (
        <div
          role="status"
          className={cn(
            'flex items-start gap-2 rounded-lg border p-3 text-sm',
            banner.kind === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
              : 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300'
          )}
        >
          {banner.kind === 'success' ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{banner.message}</span>
          <button type="button" onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Desktop: the right column is pinned to the form card's exact height
          (absolute inset in a stretched cell), so both cards share the same
          bottom edge; the preview and the manual scroll inside themselves. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
      <div className="rounded-xl border bg-card p-6 space-y-4">
        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
          <Input
            id="title"
            placeholder="Solution title"
            value={form.title}
            readOnly={readOnly}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          {showError('title') && <p className="text-xs text-destructive">{errors.title}</p>}
        </div>

        {/* Product */}
        <div className="space-y-1.5">
          {readOnly ? (
            <>
              <Label>Product <span className="text-destructive">*</span></Label>
              <p className="text-sm text-foreground">{selectedProduct?.name ?? '—'}</p>
            </>
          ) : (
            <SearchableSelect
              label="Product"
              required
              icon={Package}
              options={activeProducts.map((p) => ({ id: p.id, label: p.name, sublabel: p.category }))}
              value={form.product_id}
              onChange={(v) => setForm({ ...form, product_id: v })}
              placeholder="Select a product"
              searchPlaceholder="Search products…"
              emptyText="No matching products"
            />
          )}
          {showError('product_id') && <p className="text-xs text-destructive">{errors.product_id}</p>}
        </div>

        {/* Case reference (optional) */}
        <div className="space-y-1.5">
          {readOnly ? (
            selectedCase && (
              <>
                <Label>Case Reference</Label>
                <p className="text-sm text-foreground">{selectedCase.reference_no} — {selectedCase.title}</p>
              </>
            )
          ) : (
            <SearchableSelect
              label="Case Reference (optional)"
              icon={Ticket}
              options={cases.map((c) => ({ id: c.id, label: `${c.reference_no} — ${c.title}` }))}
              value={form.case_id}
              onChange={(v) => setForm({ ...form, case_id: v })}
              placeholder="Link a case (optional)"
              searchPlaceholder="Search by case ID or title…"
              emptyText="No matching cases"
            />
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label>Description <span className="text-destructive">*</span></Label>
          {readOnly ? (
            <div className="rounded-lg border bg-muted/30 p-4">
              {form.description.trim()
                ? <MarkdownViewer content={form.description} />
                : <p className="text-sm text-muted-foreground">No description.</p>}
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden min-w-0">
              <MarkdownEditor
                markdown={form.description}
                onChange={handleDescriptionChange}
                placeholder="Describe the solution… Use the toolbar or markdown shortcuts: # heading, **bold**, `code`, - list"
                className="nhq-editor-compact"
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Markdown is supported — the rendered result appears in the live preview panel.
          </p>
          {showError('description') && <p className="text-xs text-destructive">{errors.description}</p>}
        </div>

        {/* Auto-captured metadata (read-only context) */}
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-0.5">
          <p>Author: <span className="font-medium text-foreground">{currentUser?.name ?? '—'}</span></p>
          <p>Role: <span className="font-medium text-foreground">{ROLE_LABELS[session.role] ?? session.role}</span></p>
          <p>Date: <span className="font-medium text-foreground">{new Date().toLocaleDateString()}</span></p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={!readOnly} onClick={handleEdit}>
          Edit
          </Button>
          <Button disabled={readOnly || saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save'}
          </Button>

        </div>
      </div>

      {/* ── Live preview + markdown manual ──────────────────────────────────── */}
      <div className="min-w-0 lg:relative">
      <div className="min-w-0 space-y-4 lg:absolute lg:inset-0 lg:flex lg:flex-col lg:gap-4 lg:space-y-0">
      <div className="rounded-xl border bg-card min-w-0 lg:flex lg:flex-col lg:min-h-0 lg:shrink-0 lg:max-h-[55%]">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /> Live preview
          </span>
          <span className="text-[11px] text-muted-foreground">rendered exactly as published</span>
        </div>
        <div className="p-5 sm:p-6 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          {deferredTitle.trim() || selectedProduct || deferredDescription.trim() ? (
            <div className="space-y-4">
              {(deferredTitle.trim() || selectedProduct) && (
                <div className="space-y-2">
                  {deferredTitle.trim() && (
                    <h2 className="text-2xl font-bold leading-tight tracking-tight break-words">
                      {deferredTitle}
                    </h2>
                  )}
                  {selectedProduct && (
                    <span className="inline-flex items-center rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {selectedProduct.name}
                    </span>
                  )}
                </div>
              )}
              {deferredDescription.trim() ? (
                <MarkdownViewer content={deferredDescription} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add a description to see it rendered here.
                </p>
              )}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Start typing on the left — your solution renders here in real time.
            </p>
          )}
        </div>

        {/* Author metadata — mirrors what gets saved with the solution */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-5 py-3 sm:px-6 text-xs text-muted-foreground lg:shrink-0">
          <span>Author: <span className="font-medium text-foreground">{currentUser?.name ?? '—'}</span></span>
          <span>Role: <span className="font-medium text-foreground">{ROLE_LABELS[session.role] ?? session.role}</span></span>
          <span>Date: <span className="font-medium text-foreground">{new Date().toLocaleDateString()}</span></span>
        </div>
      </div>

      {/* How-to manual: each notation with its rendered result */}
      <MarkdownGuide />
      </div>
      </div>
      </div>
    </div>
  )
}
