'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { Ticket } from 'lucide-react'

const MyCases = dynamic(
  () => import('@/modules/client/my-cases').then((m) => m.MyCases),
  { loading: () => <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div> }
)

export default function MyCasesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Ticket className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Cases</h1>
          <p className="text-sm text-muted-foreground">Track the status and history of all your support cases</p>
        </div>
      </div>

      <Suspense fallback={<div className="h-40 rounded-xl bg-muted animate-pulse" />}>
        <MyCases />
      </Suspense>
    </div>
  )
}
