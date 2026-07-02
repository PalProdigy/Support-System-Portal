'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { ArrowLeft } from 'lucide-react'
import { TechnicalHeadProfile } from '@/modules/profile/technical-head-profile'
import { TeamLeadProfile } from '@/modules/profile/team-lead-profile'
import { SupportEngineerProfile } from '@/modules/profile/support-engineer-profile'
import { SalesExecutiveProfile } from '@/modules/profile/sales-executive-profile'
import { ClientProfile } from '@/modules/profile/client-profile'

export default function ProfilePage() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })

  const user = (users ?? []).find((u) => u.id === session.userId) ?? null
  const teamName = user?.team_id ? (teams ?? []).find((t) => t.id === user.team_id)?.name : undefined

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-32 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <ErrorState message="Your profile could not be loaded." />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {session.role === 'technical_head' && <TechnicalHeadProfile user={user} />}
      {session.role === 'team_lead' && <TeamLeadProfile user={user} />}
      {session.role === 'support_engineer' && <SupportEngineerProfile user={user} teamName={teamName} />}
      {session.role === 'sales_executive' && <SalesExecutiveProfile user={user} />}
      {session.role === 'client' && <ClientProfile user={user} />}
    </div>
  )
}
