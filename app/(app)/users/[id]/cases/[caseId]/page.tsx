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

export default function UserCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string; caseId: string }>
}) {
  const { caseId } = use(params)
  return <CaseDetail caseId={caseId} />
}