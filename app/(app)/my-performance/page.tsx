'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { useSession } from '@/lib/auth/context'
import { redirect } from 'next/navigation'
import { TrendingUp } from 'lucide-react'
import type { Role } from '@/types'

const ALLOWED_ROLES: Role[] = ['technical_head', 'team_lead', 'support_engineer', 'sales_executive']

const SalesPerformanceDashboard = dynamic(
  () => import('@/modules/sales-executive/performance-dashboard').then((m) => m.SalesPerformanceDashboard),
  {
    loading: () => (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
        </div>
      </div>
    ),
  }
)

const PerformanceDashboard = dynamic(
  () => import('@/modules/engineer/performance-dashboard').then((m) => m.PerformanceDashboard),
  {
    loading: () => (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
      </div>
    ),
  }
)

function Guard() {
  const session = useSession()
  if (!ALLOWED_ROLES.includes(session.role)) redirect('/dashboard')
  return null
}

const SUBTITLES: Partial<Record<Role, string>> = {
  sales_executive: 'Your target, achievement, pipeline and deal history at a glance',
}
const DEFAULT_SUBTITLE = 'Your resolved cases, SLA compliance and satisfaction at a glance'

export default function MyPerformancePage() {
  const session = useSession()

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <Guard />
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Performance</h1>
          <p className="text-sm text-muted-foreground">{SUBTITLES[session.role] ?? DEFAULT_SUBTITLE}</p>
        </div>
      </div>

      <Suspense fallback={null}>
        {session.role === 'sales_executive' ? <SalesPerformanceDashboard /> : <PerformanceDashboard />}
      </Suspense>
    </div>
  )
}
