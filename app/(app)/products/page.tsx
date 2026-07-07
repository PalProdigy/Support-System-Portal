'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type CSSProperties } from 'react'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { toast } from '@/hooks/use-toast'
import {
  Package, PlusCircle, Pencil, Search, ArrowLeft, ArrowRight, Loader2,
  ShieldCheck, Network, ShieldAlert, ScanSearch, DatabaseBackup, Cloud, Server, Layers,
  type LucideIcon,
} from 'lucide-react'
import { canAccess } from '@/lib/rbac'
import type { Product } from '@/types'

type CategoryStyle = { color: string; tint: string; shade: string }
type CategoryMeta = CategoryStyle & { mono: string; icon: LucideIcon }

const CATEGORY_PALETTE: CategoryStyle[] = [
  { color: '#16a34a', tint: '#e8f7ee', shade: '#0f7a37' },
  { color: '#2a5fd8', tint: '#e9effc', shade: '#1f49ad' },
  { color: '#7c3aed', tint: '#f1ecfd', shade: '#6025c9' },
  { color: '#d97706', tint: '#fdf3e3', shade: '#b25e04' },
  { color: '#e11d48', tint: '#fdeaef', shade: '#b0173a' },
  { color: '#0891b2', tint: '#e5f6fa', shade: '#066a86' },
  { color: '#059669', tint: '#e6f6f1', shade: '#04754f' },
  { color: '#0d9488', tint: '#e5f5f3', shade: '#096e64' },
]

const CATEGORY_META: Record<string, CategoryMeta> = {
  'Endpoint & Server Security': { mono: 'ES', icon: ShieldCheck, ...CATEGORY_PALETTE[0] },
  'Network & Gateway Security': { mono: 'NG', icon: Network, ...CATEGORY_PALETTE[1] },
  'Risk & Compliance': { mono: 'RC', icon: ShieldAlert, ...CATEGORY_PALETTE[2] },
  'Vulnerability Assessment': { mono: 'VA', icon: ScanSearch, ...CATEGORY_PALETTE[3] },
  'Data Protection': { mono: 'DP', icon: DatabaseBackup, ...CATEGORY_PALETTE[4] },
  'Virtualization & Cloud': { mono: 'VC', icon: Cloud, ...CATEGORY_PALETTE[5] },
  'Data Center Security': { mono: 'DC', icon: Server, ...CATEGORY_PALETTE[6] },
  'Infrastructure': { mono: 'IN', icon: Layers, ...CATEGORY_PALETTE[7] },
}

function hashString(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function getCategoryMeta(name: string): CategoryMeta {
  if (CATEGORY_META[name]) return CATEGORY_META[name]
  const palette = CATEGORY_PALETTE[hashString(name) % CATEGORY_PALETTE.length]
  const mono = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '—'
  return { mono, icon: Package, ...palette }
}

function accentVars(meta: CategoryStyle): CSSProperties {
  return { '--accent': meta.color, '--accent-tint': meta.tint, '--accent-shade': meta.shade } as CSSProperties
}

export default function ProductsPage() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Product | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', description: '', category: '', is_active: true })

  const { data: products, isLoading } = useQuery({ queryKey: ['products'], queryFn: () => dp.listProducts() })
  const canManage = canAccess(scope, 'manage_products', 'product')

  // Managers see inactive products too; everyone else only sees the live catalog.
  const visible = useMemo(() => (products ?? []).filter((p) => canManage || p.is_active), [products, canManage])

  const searching = query.trim().length > 0
  const searchResults = useMemo(() => {
    if (!searching) return []
    const q = query.toLowerCase()
    return visible.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q))
  }, [visible, query, searching])

  async function runSearch() {
    if (isSearching) return
    setIsSearching(true)
    await new Promise((resolve) => setTimeout(resolve, 450))
    setQuery(search)
    setIsSearching(false)
  }

  const categories = useMemo(() => {
    const byName = new Map<string, Product[]>()
    for (const p of visible) {
      const key = p.category || 'Other'
      byName.set(key, [...(byName.get(key) ?? []), p])
    }
    return [...byName.entries()].map(([name, items]) => ({ name, items, meta: getCategoryMeta(name) }))
  }, [visible])

  const activeCategory = useMemo(() => categories.find((c) => c.name === selectedCategory) ?? null, [categories, selectedCategory])

  const createMutation = useMutation({
    mutationFn: () => dp.createProduct(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast({ title: 'Product created', variant: 'success' }); setShowCreate(false); setForm({ name: '', description: '', category: '', is_active: true }) },
    onError: () => toast({ title: 'Failed', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: (p: Product) => dp.updateProduct(p.id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast({ title: 'Product updated', variant: 'success' }); setEditing(null) },
    onError: () => toast({ title: 'Failed', variant: 'destructive' }),
  })

  function startEdit(e: React.MouseEvent | React.KeyboardEvent, p: Product) {
    e.stopPropagation()
    setEditing({ ...p })
  }

  function ProductCard({ product, meta }: { product: Product; meta: CategoryMeta }) {
    const Icon = meta.icon
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setViewing(product)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setViewing(product)}
        style={accentVars(meta)}
        className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-lg"
      >
        <div
          className="relative flex h-28 items-center justify-center overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${meta.color} 0%, ${meta.shade} 100%)` }}
        >
          <div className="absolute -right-14 -top-16 h-52 w-52 rounded-full bg-white/10" />
          <div className="absolute -bottom-12 -left-8 h-36 w-36 rounded-full border border-white/15" />
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 shadow-inner backdrop-blur-sm">
            <Icon className="h-7 w-7 text-white" />
          </div>
          <span className="absolute left-4 top-3 text-[11px] font-semibold tracking-wide text-white/90">{product.category || 'Other'}</span>
          {canManage && !product.is_active && (
            <span className="absolute right-3.5 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-red-600">Inactive</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2.5 p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[15px] font-semibold leading-snug text-foreground">{product.name}</p>
            {canManage && (
              <button
                type="button"
                onClick={(e) => startEdit(e, product)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">{product.description}</p>
          <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
            <span className="text-[13px] font-semibold text-[var(--accent)]">Details</span>
            <ArrowRight className="h-3.5 w-3.5 text-[var(--accent)] transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-6 py-10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Products Category</h1>
            <p className="text-sm text-muted-foreground">Browse NHQ's product and solution portfolio · {visible.length} {visible.length === 1 ? 'product' : 'products'}</p>
          </div>
        </div>
        {canManage && <Button onClick={() => setShowCreate(true)}><PlusCircle className="h-4 w-4 text-white" /> <span className="text-white">Add Category</span></Button>}
      </div>

      <div className="flex max-w-md items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          />
        </div>
        <Button type="button" onClick={runSearch} disabled={isSearching} className="shrink-0">
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Search className="h-4 w-4 text-white" />}
          <span className="text-white">Search</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{[...Array(6)].map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : searching ? (
        searchResults.length === 0 ? (
          <EmptyState icon={Package} title="No products found" description="Try a different search term." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {searchResults.map((product) => (
              <ProductCard key={product.id} product={product} meta={getCategoryMeta(product.category || 'Other')} />
            ))}
          </div>
        )
      ) : visible.length === 0 ? (
        <EmptyState icon={Package} title="No products found" description="No products are available yet." />
      ) : activeCategory ? (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            style={accentVars(activeCategory.meta)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <ArrowLeft className="h-4 w-4" /> All categories
          </button>

          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[13px] font-bold"
              style={{ background: activeCategory.meta.tint, color: activeCategory.meta.color }}
            >
              {activeCategory.meta.mono}
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{activeCategory.name}</h2>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: activeCategory.meta.tint, color: activeCategory.meta.color }}
            >
              {activeCategory.items.length} {activeCategory.items.length === 1 ? 'product' : 'products'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeCategory.items.map((product) => (
              <ProductCard key={product.id} product={product} meta={activeCategory.meta} />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map(({ name, items, meta }) => {
            const Icon = meta.icon
            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedCategory(name)}
                style={accentVars(meta)}
                className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: meta.tint }}>
                    <Icon className="h-5 w-5" style={{ color: meta.color }} />
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: meta.tint, color: meta.color }}>
                    {items.length} {items.length === 1 ? 'product' : 'products'}
                  </span>
                </div>
                <div>
                  <div className="text-[15px] font-semibold tracking-tight text-foreground">{name}</div>
                  <div className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {items.length} solution{items.length === 1 ? '' : 's'} in this category
                  </div>
                </div>
                <div className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-[var(--accent)]">
                  View products <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Product detail dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-1.5">
                <Package className="h-4 w-4 text-primary" />
              </div>
              {viewing?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {viewing?.category && <Badge variant="secondary">{viewing.category}</Badge>}
            <p className="text-sm text-foreground leading-relaxed">{viewing?.description}</p>
          </div>
          <DialogFooter>
            {canManage && viewing && (
              <Button variant="outline" size="sm" onClick={() => { setEditing({ ...viewing }); setViewing(null) }}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setViewing(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create dialog (managers only) */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Endpoint & Server Security" /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={createMutation.isPending || !form.name} onClick={() => createMutation.mutate()}>{createMutation.isPending ? 'Saving...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog (managers only) */}
      {editing && (
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Product</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Category</Label><Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Description</Label><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} /></div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Active</Label></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate(editing)}>{updateMutation.isPending ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
