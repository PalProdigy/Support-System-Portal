'use client'

import { useState, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from '@/lib/auth/context'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SearchInput } from '@/components/ui/search-input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Shield, TrendingUp, ShieldAlert, MessageSquare, Briefcase } from 'lucide-react'
import { NotesHub } from '@/modules/sales-executive/notes-hub'

const Pipeline = dynamic(
  () => import('@/modules/sales-executive/pipeline').then((m) => ({ default: m.Pipeline })),
  { loading: () => <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div> }
)

const SLAMonitor = dynamic(
  () => import('@/modules/sales-executive/sla-monitor').then((m) => ({ default: m.SLAMonitor })),
  { loading: () => <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div> }
)

const ManageSalesExecutives = dynamic(
  () => import('@/modules/sales-executive/manage-sales-executives').then((m) => ({ default: m.ManageSalesExecutives })),
  { loading: () => <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div> }
)

export default function SalesExecutiveHubPage() {
  const session = useSession()

  // The Sales Executive works their own pipeline/notes/SLA here.
  // The Technical Head uses this same route to administer Sales Executive
  // accounts (merged in as a tab).
  const isTH = session.role === 'technical_head'
  const isAM = session.role === 'sales_executive'

  const [tab, setTab] = useState(isTH && !isAM ? 'manage' : 'pipeline')
  const [query, setQuery] = useState('')
  const [resultCount, setResultCount] = useState(0)

  if (!isAM && !isTH) {
    return <EmptyState icon={Shield} title="Access Denied" description="This section is for Sales Executives." />
  }

  return (
    <div className="p-6 space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{isAM ? 'Sales Hub' : 'Sales Executives'}</h1>
          <p className="text-sm text-muted-foreground">
            {isAM
              ? 'Manage your pipeline, notes, and SLA health.'
              : 'Administer Sales Executive accounts and review pipeline health.'}
          </p>
        </div>
        {isTH && (
          <div className="max-w-md w-full">
            <SearchInput
              placeholder="Search account managers..."
              value={query}
              onChange={setQuery}
              aria-label="Search account managers"
              resultCount={resultCount}
              resultLabel="account manager"
            />
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        {isAM && (
          <TabsList className="w-full">
            <TabsTrigger value="pipeline" className="flex-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex-1">
              <MessageSquare className="h-3.5 w-3.5" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="sla" className="flex-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              SLA Monitor
            </TabsTrigger>
          </TabsList>
        )}

        {isAM && (
          <>
            <TabsContent value="pipeline" className="mt-5">
              <Suspense fallback={null}>
                <Pipeline />
              </Suspense>
            </TabsContent>

            <TabsContent value="notes" className="mt-5">
              <Suspense fallback={null}>
                <NotesHub />
              </Suspense>
            </TabsContent>

            <TabsContent value="sla" className="mt-5">
              <Suspense fallback={null}>
                <SLAMonitor />
              </Suspense>
            </TabsContent>
          </>
        )}

        {isTH && (
          <TabsContent value="manage" className="mt-5">
            <Suspense fallback={null}>
              <ManageSalesExecutives query={query} onResultCountChange={setResultCount} />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
