'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { useSession } from '@/lib/auth/context'
import { redirect } from 'next/navigation'
import { TrendingUp } from 'lucide-react'

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

function Guard() {
  const session = useSession()
  if (session.role !== 'sales_executive') redirect('/dashboard')
  return null
}

export default function MyPerformancePage() {
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <Guard />
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Performance</h1>
          <p className="text-sm text-muted-foreground">Your target, achievement, pipeline and deal history at a glance</p>
        </div>
      </div>

      <Suspense fallback={null}>
        <SalesPerformanceDashboard />
      </Suspense>
    </div>
  )
}
