'use client'

import { useState, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from '@/lib/auth/context'
import { canAccess } from '@/lib/rbac'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Shield, TrendingUp, Building2, ShieldAlert, PlusCircle } from 'lucide-react'
import { CreateClientDialog } from '@/modules/account-manager/create-client-dialog'

const Pipeline = dynamic(
  () => import('@/modules/account-manager/pipeline').then((m) => ({ default: m.Pipeline })),
  { loading: () => <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div> }
)

const MyClients = dynamic(
  () => import('@/modules/account-manager/my-clients').then((m) => ({ default: m.MyClients })),
  { loading: () => <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div> }
)

const SLAMonitor = dynamic(
  () => import('@/modules/account-manager/sla-monitor').then((m) => ({ default: m.SLAMonitor })),
  { loading: () => <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div> }
)

export default function AccountManagerHubPage() {
  const session = useSession()
  const scope = { userId: session.userId, role: session.role }
  const [showCreateClient, setShowCreateClient] = useState(false)
  const [tab, setTab] = useState('pipeline')

  if (!canAccess(scope, 'manage_prospects', 'prospect') && !canAccess(scope, 'read', 'prospect')) {
    return <EmptyState icon={Shield} title="Access Denied" description="This section is for Account Managers." />
  }

  const canManage = canAccess(scope, 'manage_prospects', 'prospect')

  return (
    <div className="p-6 space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">AM Hub</h1>
          <p className="text-sm text-muted-foreground">Manage your pipeline, client accounts, and SLA health.</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreateClient(true)}>
            <PlusCircle className="h-4 w-4" /> Create Client Account
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pipeline">
            <TrendingUp className="h-3.5 w-3.5" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="clients">
            <Building2 className="h-3.5 w-3.5" />
            My Clients
          </TabsTrigger>
          <TabsTrigger value="sla">
            <ShieldAlert className="h-3.5 w-3.5" />
            SLA Monitor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-5">
          <Suspense fallback={null}>
            <Pipeline />
          </Suspense>
        </TabsContent>

        <TabsContent value="clients" className="mt-5">
          <Suspense fallback={null}>
            <MyClients />
          </Suspense>
        </TabsContent>

        <TabsContent value="sla" className="mt-5">
          <Suspense fallback={null}>
            <SLAMonitor />
          </Suspense>
        </TabsContent>
      </Tabs>

      <CreateClientDialog open={showCreateClient} onOpenChange={setShowCreateClient} />
    </div>
  )
}