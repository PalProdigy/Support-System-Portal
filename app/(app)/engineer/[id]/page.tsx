'use client'

import { use } from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useSession } from '@/lib/auth/context'
import { canAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

const CaseWorkspace = dynamic(
  () => import('@/modules/engineer/case-workspace').then((m) => m.CaseWorkspace),
  { loading: () => <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div> }
)

function Guard() {
  const session = useSession()
  const scope = { userId: session.userId, role: session.role }
  if (!canAccess(scope, 'resolve', 'case')) redirect('/dashboard')
  return null
}

interface Props { params: Promise<{ id: string }> }

export default function EngineerCasePage({ params }: Props) {
  const { id } = use(params)

  return (
    <div className="space-y-5">
      <Guard />
      <div>
        <Link href="/engineer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to My Cases
        </Link>
      </div>

      <Suspense fallback={<div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>}>
        <CaseWorkspace caseId={id} />
      </Suspense>
    </div>
  )
}