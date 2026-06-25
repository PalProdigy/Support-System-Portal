'use client'

import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Building2, PlusCircle, Phone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Client } from '@/types'
import { formatDate } from '@/lib/utils'
import { canAccess } from '@/lib/rbac'

export default function ClientsPage() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
  })

  const canCreate = canAccess(scope, 'create', 'client')

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">{clients?.length ?? 0} clients</p>
        </div>
        {canCreate && (
          <Button onClick={() => router.push('/clients/new')}>
            <PlusCircle className="h-4 w-4" /> Add Client
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : (clients ?? []).length === 0 ? (
        <EmptyState icon={Building2} title="No clients" description="No clients in your scope yet." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(clients ?? []).map((c: Client) => (
            <div
              key={c.id}
              className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/clients/${c.id}`)}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{c.company_name}</p>
                  <p className="text-sm text-muted-foreground truncate">{c.contact_person}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{c.phone}</span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Since {formatDate(c.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}