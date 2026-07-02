'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
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
import { Package, PlusCircle, Pencil, Search } from 'lucide-react'
import { canAccess } from '@/lib/rbac'
import type { Product } from '@/types'

export default function ProductsPage() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<Product | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', description: '', category: '', is_active: true })

  const { data: products, isLoading } = useQuery({ queryKey: ['products'], queryFn: () => dp.listProducts() })
  const canManage = canAccess(scope, 'manage_products', 'product')

  // Managers see inactive products too; everyone else only sees the live catalog.
  const filtered = useMemo(() => {
    return (products ?? []).filter((p) => {
      if (!canManage && !p.is_active) return false
      if (!search) return true
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q)
    })
  }, [products, canManage, search])

  const categories = useMemo(() => [...new Set(filtered.map((p) => p.category).filter(Boolean))], [filtered])

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

  function startEdit(e: React.MouseEvent, p: Product) {
    e.stopPropagation()
    setEditing({ ...p })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Products</h1>
            <p className="text-sm text-muted-foreground">Browse NHQ's product and solution portfolio · {filtered.length} {filtered.length === 1 ? 'product' : 'products'}</p>
          </div>
        </div>
        {canManage && <Button onClick={() => setShowCreate(true)}><PlusCircle className="h-4 w-4" /> Add Product</Button>}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="No products found" description={search ? 'Try a different search term.' : 'No products are available yet.'} />
      ) : (
        <div className="space-y-6">
          {(search ? [undefined] : categories).map((cat) => {
            const items = cat === undefined ? filtered : filtered.filter((p) => p.category === cat)
            if (items.length === 0) return null
            return (
              <div key={cat ?? 'all'} className="space-y-3">
                {cat && !search && (
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{cat}</h3>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => setViewing(product)}
                      className="text-left rounded-xl border bg-card p-4 hover:shadow-sm hover:bg-accent/20 transition-all space-y-2"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sm text-foreground truncate">{product.name}</p>
                            {canManage && (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => startEdit(e, product)}
                                className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent text-muted-foreground"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                          {product.category && (
                            <Badge variant="secondary" className="text-[10px] mt-0.5">{product.category}</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 pl-11">{product.description}</p>
                      {canManage && !product.is_active && <span className="text-xs text-red-500 block pl-11">Inactive</span>}
                    </button>
                  ))}
                </div>
              </div>
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