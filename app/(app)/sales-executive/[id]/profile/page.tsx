'use client'

import { use } from 'react'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const SalesExecutiveFullProfile = dynamic(
  () => import('@/modules/profile/sales-executive-full-profile').then((m) => m.SalesExecutiveFullProfile),
  {
    loading: () => (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-32 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    ),
  }
)

export default function SalesExecutiveProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <SalesExecutiveFullProfile id={id} />
}
