'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { useSession } from '@/lib/auth/context'
import { canAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { Wrench } from 'lucide-react'

function ListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
      </div>
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
      </div>
    </div>
  )
}

// "My Cases" — merges what used to be the separate /cases page (search,
// filters, KPI overview, pagination) with this hub's assigned-cases list,
// so a support engineer has one organized workspace instead of two
// overlapping pages.
const MyCases = dynamic(
  () => import('@/modules/engineer/my-cases').then((m) => m.MyCases),
  { loading: () => <ListSkeleton /> }
)

function Guard() {
  const session = useSession()
  const scope = { userId: session.userId, role: session.role }
  if (!canAccess(scope, 'resolve', 'case')) redirect('/dashboard')
  return null
}

export default function EngineerHubPage() {
  return (
    <div className="p-6 space-y-6">
      <Guard />
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Wrench className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Cases</h1>
          <p className="text-sm text-muted-foreground">Every case assigned to you</p>
        </div>
      </div>

      <Suspense fallback={<ListSkeleton />}>
        <MyCases />
      </Suspense>
    </div>
  )
}
