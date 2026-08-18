'use client'

import { use, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { UserAvatar } from '@/components/shared/user-avatar'
import { ArrowLeft, Package, PlusCircle, Pencil, CalendarDays, Tag, CheckCircle2, XCircle, Mail, Phone, IdCard, Contact } from 'lucide-react'
import { canAccess } from '@/lib/rbac'
import type { Product } from '@/types'
import { accentVars, getCategoryMeta, ProductCard } from '@/lib/products-shared'
import { ProductFormDialog } from '@/modules/products/product-form-dialog'
import { formatDate } from '@/lib/utils'

export default function ProductCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = use(params)
  const categoryName = decodeURIComponent(category)

  const session = useSession()
  const router = useRouter()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const [viewing, setViewing] = useState<Product | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [activeImage, setActiveImage] = useState(0)

  function openView(product: Product) {
    setActiveImage(0)
    setViewing(product)
  }

  const { data: products, isLoading } = useQuery({ queryKey: ['products'], queryFn: () => dp.listProducts() })
  const canManage = canAccess(scope, 'manage_products', 'product')

  const visible = useMemo(() => (products ?? []).filter((p) => canManage || p.is_active), [products, canManage])
  const items = useMemo(() => visible.filter((p) => (p.category || 'Other') === categoryName), [visible, categoryName])
  const meta = useMemo(() => getCategoryMeta(categoryName), [categoryName])

  function startEdit(e: React.MouseEvent | React.KeyboardEvent, p: Product) {
    e.stopPropagation()
    setEditing({ ...p })
  }

  return (
    <div className="">
      <button
        type="button"
        onClick={() => router.push('/products')}
        style={accentVars(meta)}
        className="inline-flex items-center gap-2 rounded-lg  bg-card px-3.5 py-2 ml-2 mb-1 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        <ArrowLeft className="h-4 w-4" /> All OEMs
      </button>

      <div className="space-y-6 px-6 ">
      <div className="flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold tracking-wide"
            style={{ background: meta.tint, color: meta.color }}
          >
            {meta.mono}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">Products</h1>
            <p className="truncate text-sm text-muted-foreground">{categoryName} · {items.length} {items.length === 1 ? 'product' : 'products'}</p>
          </div>
        </div>
        {canManage && (
          <Button type="button" onClick={() => setShowCreate(true)} className="shrink-0" style={{ background: meta.color }}>
            <PlusCircle className="h-4 w-4 text-white" /> <span className="text-white">Add Product</span>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{[...Array(6)].map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Package} title="No products found" description="This OEM doesn't have any products yet." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} meta={meta} canManage={canManage} onView={openView} onEdit={startEdit} />
          ))}
        </div>
      )}

      {/* Product detail dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{viewing?.name}</DialogTitle>
          </DialogHeader>

          {viewing && (
            <div>
              {/* Hero banner */}
              {(viewing.image_urls?.length ?? 0) > 0 ? (
                <div className="space-y-2 p-4 pb-0">
                  <div
                    className="relative flex h-52 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted"
                    style={accentVars(meta)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={viewing.image_urls![activeImage]}
                      alt={viewing.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {viewing.image_urls!.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {viewing.image_urls!.map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActiveImage(i)}
                          className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                            i === activeImage ? 'border-[var(--accent)]' : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                          style={accentVars(meta)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`${viewing.name} ${i + 1}`} className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="relative flex h-40 items-center justify-center overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${meta.color} 0%, ${meta.shade} 100%)` }}
                >
                  <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
                  <div className="absolute -bottom-10 -left-6 h-28 w-28 rounded-full border border-white/15" />
                  <Package className="h-10 w-10 text-white/90" />
                </div>
              )}

              <div className="p-5 space-y-4">
                {/* Title + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-foreground leading-snug">{viewing.name}</h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {viewing.category && (
                        <Badge
                          variant="secondary"
                          className="inline-flex items-center gap-1 font-medium"
                          style={{ background: meta.tint, color: meta.color }}
                        >
                          <Tag className="h-3 w-3" /> {viewing.category}
                        </Badge>
                      )}
                      <Badge
                        variant="secondary"
                        className={
                          viewing.is_active
                            ? 'inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'inline-flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }
                      >
                        {viewing.is_active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {viewing.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    <CalendarDays className="h-3 w-3" /> {formatDate(viewing.created_at)}
                  </span>
                </div>

                {/* Description */}
                <div className="rounded-xl border bg-muted/30 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Description</p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{viewing.description || '—'}</p>
                </div>

                {/* Product Manager(s) */}
                {(viewing.managers?.length ?? 0) > 0 && (
                  <div className="rounded-xl border overflow-hidden">
                    <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.shade})` }} />
                    <div className="p-3.5 space-y-3">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Contact className="h-3.5 w-3.5" /> Product Manager{viewing.managers!.length > 1 ? 's' : ''}
                      </p>
                      <div className="space-y-3 divide-y divide-border">
                        {viewing.managers!.map((manager) => (
                          <div key={manager.id} className="space-y-2 pt-3 first:pt-0">
                            <div className="flex items-center gap-3">
                              <UserAvatar name={manager.name} size="md" border shadow />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground truncate">{manager.name}</p>
                                {(manager.designation || manager.employee_id) && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {manager.designation}
                                    {manager.designation && manager.employee_id ? ' · ' : ''}
                                    {manager.employee_id}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {manager.email && (
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                                  <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} /> {manager.email}
                                </span>
                              )}
                              {manager.phone && (
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                                  <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} /> {manager.phone}
                                </span>
                              )}
                              {manager.employee_id && (
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                                  <IdCard className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} /> {manager.employee_id}
                                </span>
                              )}
                              {manager.joining_date && (
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                                  <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} /> Joined {formatDate(manager.joining_date)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="px-5 py-4 border-t bg-muted/20">
            {canManage && viewing && (
              <Button variant="outline" size="sm" onClick={() => { setEditing({ ...viewing }); setViewing(null) }}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setViewing(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Product — same form, different mode (managers only) */}
      {showCreate && (
        <ProductFormDialog mode="create" category={categoryName} open={showCreate} onOpenChange={setShowCreate} />
      )}
      {editing && (
        <ProductFormDialog
          mode="edit"
          category={categoryName}
          product={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </div>
    </div>
  )
}
