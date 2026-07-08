'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { EmptyState } from '@/components/shared/empty-state'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Package, Search, Loader2 } from 'lucide-react'
import type { Product } from '@/types'

export function ProductCatalog() {
  const dp = getDataProvider()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [viewing, setViewing] = useState<Product | null>(null)

  const runSearch = () => {
    setIsSearching(true)
    setQuery(search)
    setTimeout(() => setIsSearching(false), 300)
  }

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => dp.listProducts(),
  })

  const filtered = (products ?? []).filter((p) => {
    if (!p.is_active) return false
    if (!query) return true
    const q = query.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q)
  })

  const categories = [...new Set(filtered.map((p) => p.category).filter(Boolean))]

  if (isLoading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}
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
              placeholder="Search products…"
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
          <EmptyState icon={Package} title="No products found" description="Try a different search term." />
        ) : (
          <div className="space-y-6">
            {(query ? [undefined] : categories).map((cat) => {
              const items = cat === undefined
                ? filtered
                : filtered.filter((p) => p.category === cat)
              if (items.length === 0) return null
              return (
                <div key={cat ?? 'all'} className="space-y-3">
                  {cat && !query && (
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
                            <p className="font-semibold text-sm text-foreground truncate">{product.name}</p>
                            {product.category && (
                              <Badge variant="secondary" className="text-[10px] mt-0.5">{product.category}</Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 pl-11">{product.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

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
            {viewing?.category && (
              <Badge variant="secondary">{viewing.category}</Badge>
            )}
            <p className="text-sm text-foreground leading-relaxed">{viewing?.description}</p>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setViewing(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}