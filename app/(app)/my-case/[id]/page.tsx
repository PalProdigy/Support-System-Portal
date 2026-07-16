'use client'

import { use } from 'react'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const CaseDetail = dynamic(() => import('@/modules/cases/case-detail'), {
  loading: () => (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  ),
})

export default function EngineerCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <CaseDetail caseId={id} />
}
