'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { ArrowLeft } from 'lucide-react'
import { SalesExecutiveProfile } from './sales-executive-profile'

export function SalesExecutiveFullProfile({ id }: { id: string }) {
  const dp = getDataProvider()
  const router = useRouter()

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })

  const user = (users ?? []).find((u) => u.id === id) ?? null
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

  if (!user || user.role !== 'sales_executive') {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <ErrorState message="Sales executive not found." />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <SalesExecutiveProfile user={user} teamName={teamName} />
    </div>
  )
}
