'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { Package } from 'lucide-react'

const ProductCatalog = dynamic(
  () => import('@/modules/client/product-catalog').then((m) => m.ProductCatalog),
  { loading: () => <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}</div> }
)

export default function ClientProductsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="text-sm text-muted-foreground">Browse our product catalog and capabilities</p>
        </div>
      </div>

      <Suspense fallback={<div className="h-40 rounded-xl bg-muted animate-pulse" />}>
        <ProductCatalog />
      </Suspense>
    </div>
  )
}