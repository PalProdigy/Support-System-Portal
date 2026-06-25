'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Workload } from './workload'
import type { User } from '@/types'

export function WorkloadContainer() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesPage, isLoading: loadingCases } = useQuery({
    queryKey: ['cases', 'team', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 200 }),
  })

  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => dp.listUsers(),
  })

  const myUser = (users ?? []).find((u) => u.id === session.userId)
  const teamId = myUser?.team_id

  const engineers: User[] = useMemo(() =>
    (users ?? []).filter((u) => u.role === 'support_engineer' && u.team_id === teamId),
    [users, teamId]
  )

  const cases = casesPage?.items ?? []

  if (loadingCases || loadingUsers) return (
    <div className="space-y-3">
      {[...Array(2)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
    </div>
  )

  return <Workload cases={cases} engineers={engineers} />
}
