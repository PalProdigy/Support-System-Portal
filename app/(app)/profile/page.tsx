'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { ArrowLeft } from 'lucide-react'
import { UserDetail } from '@/modules/users/user-detail'
import { TechnicalHeadProfile } from '@/modules/profile/technical-head-profile'
import { SalesExecutiveProfile } from '@/modules/profile/sales-executive-profile'
import { ClientProfile } from '@/modules/profile/client-profile'

export default function ProfilePage() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()

  // Support engineers & team leads get the full tabbed engineer profile
  // (Overview / Certification / Cases / Articles) with editing enabled —
  // the same page used at /users/[id], which self-detects "own profile" via session
  // and fetches its own data, so the queries below are skipped for them.
  const isEngineerProfile = session.role === 'support_engineer' || session.role === 'team_lead'

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers(), enabled: !isEngineerProfile })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams(), enabled: !isEngineerProfile })

  const user = (users ?? []).find((u) => u.id === session.userId) ?? null
  const teamName = user?.team_id ? (teams ?? []).find((t) => t.id === user.team_id)?.name : undefined

  if (isEngineerProfile) {
    return <UserDetail id={session.userId} />
  }

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

      {session.role === 'technical_head' && <TechnicalHeadProfile user={user} teamName={teamName} />}
      {session.role === 'sales_executive' && <SalesExecutiveProfile user={user} teamName={teamName} />}
      {session.role === 'client' && <ClientProfile user={user} />}
    </div>
  )
}
