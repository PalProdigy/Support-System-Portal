'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { BookOpen } from 'lucide-react'

const KBBrowse = dynamic(
  () => import('@/modules/client/kb-browse').then((m) => m.KBBrowse),
  { loading: () => <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div> }
)

export default function ClientKBPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">Browse guides, FAQs, and documentation</p>
        </div>
      </div>

      <Suspense fallback={<div className="h-40 rounded-xl bg-muted animate-pulse" />}>
        <KBBrowse />
      </Suspense>
    </div>
  )
}