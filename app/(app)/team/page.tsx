'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Users } from 'lucide-react'

const TeamDetail = dynamic(
  () => import('@/modules/teams/team-detail').then((m) => m.TeamDetail),
  {
    loading: () => (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    ),
  }
)

/**
 * "Team" — a support engineer's read-only view of the team they're engaged
 * to. Resolves their own team_id from the user record and renders the same
 * TeamDetail workspace used at /teams/[id] for leads and the technical head,
 * just without any management actions (TeamDetail already gates those on
 * role, so this stays automatically in sync with the managed version).
 */
export default function TeamPage() {
  const session = useSession()
  const router = useRouter()
  const dp = getDataProvider()

  useEffect(() => {
    if (session.role !== 'support_engineer') router.replace('/dashboard')
  }, [session.role, router])

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => dp.listUsers(),
  })

  if (session.role !== 'support_engineer') return null

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    )
  }

  const myUser = (users ?? []).find((u) => u.id === session.userId)

  if (!myUser?.team_id) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Users}
          title="No team assigned"
          description="You're not currently assigned to a team. Contact your Technical Head to get set up."
        />
      </div>
    )
  }

  return <TeamDetail teamId={myUser.team_id} />
}
