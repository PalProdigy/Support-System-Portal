'use client'

import { useAuth } from '@/lib/auth/context'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const ClientDashboard = dynamic(() => import('@/modules/cases/client-dashboard'), {
  loading: () => <DashSkeleton />,
})
const AMDashboard = dynamic(() => import('@/modules/cases/am-dashboard'), {
  loading: () => <DashSkeleton />,
})
const EngineerDashboard = dynamic(() => import('@/modules/cases/engineer-dashboard'), {
  loading: () => <DashSkeleton />,
})
const LeadDashboard = dynamic(() => import('@/modules/cases/lead-dashboard'), {
  loading: () => <DashSkeleton />,
})
const TechHeadDashboard = dynamic(() => import('@/modules/cases/techhead-dashboard'), {
  loading: () => <DashSkeleton />,
})

function DashSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

export default function DashboardPage() {
  const { session } = useAuth()

  if (!session) return null

  switch (session.role) {
    case 'client': return <ClientDashboard />
    case 'account_manager': return <AMDashboard />
    case 'support_engineer': return <EngineerDashboard />
    case 'module_lead': return <LeadDashboard />
    case 'technical_head': return <TechHeadDashboard />
    default: return null
  }
}