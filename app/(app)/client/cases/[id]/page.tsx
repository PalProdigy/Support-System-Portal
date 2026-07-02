'use client'

import { use } from 'react'
import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

const CaseTimeline = dynamic(
  () => import('@/modules/client/case-timeline').then((m) => m.CaseTimeline),
  { loading: () => <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div> }
)

export default function ClientCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <div className="space-y-4 max-w-3xl">
      <Link
        href="/client/cases"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> Back to My Cases
      </Link>

      <Suspense fallback={<div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>}>
        <CaseTimeline caseId={id} />
      </Suspense>
    </div>
  )
}