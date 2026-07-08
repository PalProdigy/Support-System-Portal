'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Package, PlusCircle, Pencil, Search, ArrowRight, Loader2 } from 'lucide-react'
import { canAccess } from '@/lib/rbac'
import type { Product } from '@/types'
import { getCategoryMeta, ProductCard } from '@/lib/products-shared'

export default function ProductsPage() {
  const session = useSession()
  const router = useRouter()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
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

  function openCategory(name: string) {
    router.push(`/products/${encodeURIComponent(name)}`)
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
              <ProductCard key={product.id} product={product} meta={getCategoryMeta(product.category || 'Other')} canManage={canManage} onView={setViewing} onEdit={startEdit} />
            ))}
          </div>
        )
      ) : visible.length === 0 ? (
        <EmptyState icon={Package} title="No products found" description="No products are available yet." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map(({ name, items, meta }) => {
            const Icon = meta.icon
            return (
              <button
                key={name}
                type="button"
                onClick={() => openCategory(name)}
                style={{ '--accent': meta.color, '--accent-tint': meta.tint, '--accent-shade': meta.shade } as React.CSSProperties}
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
