'use client'

import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { StatCard } from '@/components/shared/stat-card'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import { Ticket, CheckCircle, AlertTriangle, Star } from 'lucide-react'
import type { Case, Feedback } from '@/types'
import { STATUS_LABELS, PRIORITY_LABELS } from '@/lib/utils'

const BarChart = dynamic(
  () => import('recharts').then((m) => m.BarChart),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full rounded-xl" /> }
)
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false })
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full rounded-xl" /> }
)

export default function ReportingPage() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const { data: casesData } = useQuery({
    queryKey: ['cases', 'reporting', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 200 }),
  })

  const { data: feedback } = useQuery({
    queryKey: ['feedback', session.userId],
    queryFn: () => dp.listFeedback(scope),
  })

  const cases = casesData?.items ?? []
  const open = cases.filter((c: Case) => !['closed', 'resolved', 'pending_closure'].includes(c.status))
  const resolved = cases.filter((c: Case) => ['resolved', 'closed', 'pending_closure'].includes(c.status))
  const escalated = cases.filter((c: Case) => c.is_escalated)
  const avgRating = feedback && feedback.length
    ? (feedback.filter((f: Feedback) => f.rating).reduce((a: number, f: Feedback) => a + (f.rating ?? 0), 0) / feedback.filter((f: Feedback) => f.rating).length).toFixed(1)
    : 'N/A'

  // Cases by status
  const byStatus = Object.entries(STATUS_LABELS).map(([key, label]) => ({
    name: label,
    count: cases.filter((c: Case) => c.status === key).length,
  })).filter((d) => d.count > 0)

  // Cases by priority
  const byPriority = Object.entries(PRIORITY_LABELS).map(([key, label]) => ({
    name: label,
    count: cases.filter((c: Case) => c.priority === key).length,
  })).filter((d) => d.count > 0)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reporting</h1>
        <p className="text-sm text-muted-foreground">Case metrics and trends</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Cases" value={cases.length} icon={Ticket} />
        <StatCard title="Open" value={open.length} icon={AlertTriangle} iconColor="text-amber-500" />
        <StatCard title="Resolved" value={resolved.length} icon={CheckCircle} iconColor="text-emerald-500" />
        <StatCard title="Avg Rating" value={avgRating} icon={Star} iconColor="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Cases by Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byStatus} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(221.2, 83.2%, 53.3%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Cases by Priority</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byPriority} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(221.2, 83.2%, 53.3%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Escalated Cases ({escalated.length})</h3>
        {escalated.length === 0 ? (
          <p className="text-sm text-muted-foreground">No escalated cases.</p>
        ) : (
          <div className="divide-y">
            {escalated.map((c: Case) => (
              <div key={c.id} className="py-2.5 flex items-center justify-between text-sm">
                <span className="font-mono text-xs text-muted-foreground">{c.reference_no}</span>
                <span className="flex-1 mx-3 truncate">{c.title}</span>
                <span className="text-xs text-red-600 font-medium">L{c.escalation_level}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}