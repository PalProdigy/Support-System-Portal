'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { Bell, Mail, MessageSquare, Phone, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NotificationChannel } from '@/types'

const CHANNELS: { key: NotificationChannel; label: string; description: string; icon: React.ComponentType<{ className?: string }>; always?: boolean }[] = [
  { key: 'in_app', label: 'In-App', description: 'Notifications in the notification centre (always on)', icon: Bell, always: true },
  { key: 'email', label: 'Email', description: 'Receive updates at your registered email address', icon: Mail },
  { key: 'sms', label: 'SMS', description: 'Receive text messages to your registered phone', icon: Phone },
  { key: 'whatsapp', label: 'WhatsApp', description: 'Receive messages on WhatsApp', icon: MessageSquare },
  { key: 'web_push', label: 'Web Push', description: 'Browser push notifications when the app is not open', icon: Monitor },
]

export function NotificationPreferences() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notif-prefs', session.userId],
    queryFn: () => dp.getUserNotifPrefs(session.userId),
  })

  const [enabled, setEnabled] = useState<Set<NotificationChannel>>(new Set(['in_app']))

  useEffect(() => {
    if (prefs) setEnabled(new Set(prefs.channels))
  }, [prefs])

  const saveMutation = useMutation({
    mutationFn: () => dp.updateUserNotifPrefs(session.userId, Array.from(enabled)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notif-prefs', session.userId] })
      toast({ title: 'Notification preferences saved', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to save preferences', variant: 'destructive' }),
  })

  function toggle(ch: NotificationChannel) {
    if (ch === 'in_app') return // always on
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(ch)) next.delete(ch)
      else next.add(ch)
      return next
    })
  }

  const isDirty = prefs ? JSON.stringify([...enabled].sort()) !== JSON.stringify([...prefs.channels].sort()) : false

  if (isLoading) {
    return <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Notification Channels</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Choose how you want to receive notifications. In-app is always enabled.</p>
      </div>

      <div className="space-y-2">
        {CHANNELS.map(({ key, label, description, icon: Icon, always }) => {
          const on = enabled.has(key)
          return (
            <button
              key={key}
              type="button"
              disabled={always}
              onClick={() => toggle(key)}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all',
                on ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
                always ? 'opacity-70 cursor-default' : 'hover:bg-accent/30 cursor-pointer'
              )}
            >
              <div className={cn('rounded-lg p-2 shrink-0', on ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <div className={cn(
                'h-5 w-9 rounded-full shrink-0 transition-colors relative',
                on ? 'bg-primary' : 'bg-muted-foreground/30'
              )}>
                <span className={cn(
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  on ? 'translate-x-4' : 'translate-x-0.5'
                )} />
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button size="sm" disabled={!isDirty || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? 'Saving…' : 'Save preferences'}
        </Button>
      </div>
    </div>
  )
}