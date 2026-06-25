'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { useSession } from '@/lib/auth/context'
import { canAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { Lightbulb } from 'lucide-react'

const SolutionsDashboard = dynamic(
  () => import('@/modules/client/solutions-dashboard').then((m) => m.SolutionsDashboard),
  { loading: () => <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[...Array(2)].map((_, i) => <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />)}</div> }
)

function Guard() {
  const session = useSession()
  const scope = { userId: session.userId, role: session.role }
  if (!canAccess(scope, 'read', 'case')) redirect('/dashboard')
  return null
}

export default function ClientPortalPage() {
  return (
    <div className="space-y-6">
      <Guard />
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Lightbulb className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Solutions</h1>
          <p className="text-sm text-muted-foreground">Your active solutions — click &apos;Create Case&apos; to raise a support request</p>
        </div>
      </div>

      <Suspense fallback={<div className="h-52 rounded-xl bg-muted animate-pulse" />}>
        <SolutionsDashboard />
      </Suspense>
    </div>
  )
}
