'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { Bell, ExternalLink, CheckCheck, Ticket } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import type { Notification } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  new_case: 'New case raised',
  case_assigned: 'Case assigned',
  case_reassigned: 'Case reassigned',
  case_escalated: 'Case escalated',
  client_replied: 'Client replied',
}

function NotificationRow({ n, onView }: { n: Notification; onView: () => void }) {
  const isUnread = !n.read_at
  const payload = n.payload as { reference_no?: string; title?: string; case_id?: string }

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3.5 ${isUnread ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}>
      <div className={`rounded-full p-1.5 shrink-0 mt-0.5 ${isUnread ? 'bg-primary/10' : 'bg-muted'}`}>
        <Bell className={`h-3.5 w-3.5 ${isUnread ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className={`text-sm font-medium ${isUnread ? 'text-foreground' : 'text-muted-foreground'}`}>
          {TYPE_LABELS[n.type] ?? n.type}
        </p>
        {payload.reference_no && (
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">{payload.reference_no}</span>
            {payload.title && ` · ${payload.title}`}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground">{timeAgo(n.sent_at)}</p>
      </div>
      {payload.case_id && (
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="View case" onClick={onView}>
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}

export function ActivityFeed() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', session.userId],
    queryFn: () => dp.listNotifications(session.userId),
    refetchInterval: 30_000,
  })

  const markAllMutation = useMutation({
    mutationFn: () => dp.markAllNotificationsRead(session.userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markOneMutation = useMutation({
    mutationFn: (id: string) => dp.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const teamTypes = new Set(['new_case', 'case_assigned', 'case_reassigned', 'case_escalated', 'client_replied'])
  const teamNotifs = (notifications ?? []).filter((n) => teamTypes.has(n.type))
  const unread = teamNotifs.filter((n) => !n.read_at).length

  if (isLoading) return (
    <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {unread > 0 ? <span className="text-primary font-semibold">{unread} unread</span> : 'All caught up'} · {teamNotifs.length} team notifications
        </p>
        {unread > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAllMutation.mutate()}>
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </Button>
        )}
      </div>

      {teamNotifs.length === 0 ? (
        <EmptyState icon={Ticket} title="No team activity yet" description="New case notifications will appear here." />
      ) : (
        <div className="space-y-2">
          {teamNotifs.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              onView={() => {
                const caseId = (n.payload as { case_id?: string }).case_id
                if (caseId) {
                  markOneMutation.mutate(n.id)
                  router.push(`/cases/${caseId}`)
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}