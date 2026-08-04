'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { toast } from '@/hooks/use-toast'
import { timeAgo, cn } from '@/lib/utils'
import { Bell, CheckCheck, Settings2 } from 'lucide-react'
import { NotificationPreferences } from '@/modules/shared/notification-preferences'
import type { Notification } from '@/types'

type Tab = 'inbox' | 'preferences'

export default function NotificationsPage() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('inbox')

  // Technical Heads, Team Leads, Support Engineers, and Sales Executives manage
  // notification preferences from the shared /settings page instead of a tab here.
  const SETTINGS_ROLES: typeof session.role[] = ['technical_head', 'team_lead', 'support_engineer', 'sales_executive']
  const showPreferencesTab = !SETTINGS_ROLES.includes(session.role)

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', session.userId],
    queryFn: () => dp.listNotifications(session.userId),
  })

  const markAllMutation = useMutation({
    mutationFn: () => dp.markAllNotificationsRead(session.userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', session.userId] })
      toast({ title: 'All notifications marked as read', variant: 'success' })
    },
  })

  const markOneMutation = useMutation({
    mutationFn: (id: string) => dp.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', session.userId] }),
  })

  const unread = (notifications ?? []).filter((n: Notification) => !n.read_at).length

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">{unread} unread</p>
        </div>
        {unread > 0 && tab === 'inbox' && (
          <Button variant="outline" size="sm" onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {showPreferencesTab && (
        <div className="flex items-center gap-1 border-b">
          {([
            { key: 'inbox' as Tab, label: 'Inbox', icon: Bell },
            { key: 'preferences' as Tab, label: 'Preferences', icon: Settings2 },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}

      {showPreferencesTab && tab === 'preferences' && <NotificationPreferences />}

      {(!showPreferencesTab || tab === 'inbox') && (
        isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : (notifications ?? []).length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
        ) : (
          <div className="space-y-2">
            {(notifications ?? []).map((n: Notification) => {
              const msg = String((n.payload as { message?: string; title?: string }).message
                ?? (n.payload as { message?: string; title?: string }).title
                ?? n.type)
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer hover:shadow-sm transition-all ${!n.read_at ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}
                  onClick={() => !n.read_at && markOneMutation.mutate(n.id)}
                >
                  {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{msg}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.type.replace(/_/g, ' ')} · {timeAgo(n.sent_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}