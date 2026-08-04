'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth/context'

const ManageEngineers = dynamic(
  () => import('@/modules/support-engineer/manage-engineers').then((m) => m.ManageEngineers),
  { loading: () => <div className="p-6 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div> }
)

export default function EngineersPage() {
  const session = useSession()
  const router = useRouter()

  if (!['technical_head', 'team_lead'].includes(session.role)) {
    router.replace('/dashboard')
    return null
  }

  return <ManageEngineers />
}
