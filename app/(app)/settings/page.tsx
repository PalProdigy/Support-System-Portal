'use client'

import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { canAccess } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/hooks/use-toast'
import { EmptyState } from '@/components/shared/empty-state'
import { NotificationPreferences, type NotificationPreferencesHandle } from '@/modules/shared/notification-preferences'
import { ChangePasswordCard } from '@/modules/shared/change-password'
import { Settings, Bell, Smartphone, Shield, Save, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'nhq_system_settings'

interface SystemSettings {
  portal_name: string
  support_email: string
  sla_breach_alert: boolean
  session_timeout_minutes: number
  max_login_attempts: number
  require_2fa: boolean
  maintenance_mode: boolean
  maintenance_message: string
}

function loadSettings(): SystemSettings {
  if (typeof window === 'undefined') return defaults()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SystemSettings) : defaults()
  } catch {
    return defaults()
  }
}

function defaults(): SystemSettings {
  return {
    portal_name: 'NHQ Support Portal',
    support_email: 'support@nhqdistributions.com',
    sla_breach_alert: true,
    session_timeout_minutes: 60,
    max_login_attempts: 5,
    require_2fa: false,
    maintenance_mode: false,
    maintenance_message: 'The portal is currently under maintenance. Please check back later.',
  }
}

export default function SettingsPage() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [settings, setSettings] = useState<SystemSettings>(loadSettings)
  const [savedSettings, setSavedSettings] = useState<SystemSettings>(loadSettings)
  const set = (patch: Partial<SystemSettings>) => setSettings((s) => ({ ...s, ...patch }))
  const generalDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings)

  const notifChannelsRef = useRef<NotificationPreferencesHandle>(null)
  const [notifChannelsState, setNotifChannelsState] = useState({ isDirty: false, isPending: false })

  const notifTypesRef = useRef<NotificationPreferencesHandle>(null)
  const [notifTypesState, setNotifTypesState] = useState({ isDirty: false, isPending: false })

  if (!canAccess(scope, 'update', 'system_settings')) {
    return <EmptyState icon={Shield} title="Access Denied" description="Only Technical Heads can manage system settings." />
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      await dp.writeAuditLog({
        actor_id: session.userId,
        action: 'update',
        entity_type: 'settings',
        entity_id: 'system',
        after: { changed_keys: Object.keys(settings) },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setSavedSettings(settings)
      toast({ title: 'Settings saved', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to save settings', variant: 'destructive' }),
  })

  const Field = ({ label, children }: { label: React.ReactNode; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  )

  const SaveChangesButton = () => (
    <div className="flex justify-end">
      <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!generalDirty || saveMutation.isPending}>
        <Save className="h-4 w-4" />
        {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
      </Button>
    </div>
  )

  const generalIsDirty = generalDirty || notifChannelsState.isDirty
  const generalIsPending = saveMutation.isPending || notifChannelsState.isPending

  const GeneralSaveChangesButton = () => (
    <div className="flex justify-end">
      <Button
        size="sm"
        onClick={() => {
          if (generalDirty) saveMutation.mutate()
          if (notifChannelsState.isDirty) notifChannelsRef.current?.save()
        }}
        disabled={!generalIsDirty || generalIsPending}
      >
        <Save className="h-4 w-4" />
        {generalIsPending ? 'Saving…' : 'Save Changes'}
      </Button>
    </div>
  )

  const notificationsIsDirty = generalDirty || notifTypesState.isDirty
  const notificationsIsPending = saveMutation.isPending || notifTypesState.isPending

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Settings</h1>
        <p className="text-sm text-muted-foreground">Configure portal-wide behaviour and integrations.</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="mb-4">
          <TabsTrigger value="general"><Settings className="h-3.5 w-3.5" /> General</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-3.5 w-3.5" /> Notifications</TabsTrigger>
          <TabsTrigger value="security"><Shield className="h-3.5 w-3.5" /> Security</TabsTrigger>
          <TabsTrigger value="maintenance"><Smartphone className="h-3.5 w-3.5" /> Maintenance</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-1 divide-y">
            <div className="space-y-1.5 pb-4">
              <Label>Portal Name</Label>
              <Input value={settings.portal_name} onChange={(e) => set({ portal_name: e.target.value })} />
            </div>
            <div className="space-y-1.5 py-4">
              <Label>Support Email</Label>
              <Input type="email" value={settings.support_email} onChange={(e) => set({ support_email: e.target.value })} />
            </div>
          </div>

          <NotificationPreferences
            section="channels"
            ref={notifChannelsRef}
            hideSaveButton
            onStateChange={setNotifChannelsState}
          />

          <GeneralSaveChangesButton />
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-4">
          <NotificationPreferences
            section="types"
            ref={notifTypesRef}
            hideSaveButton
            onStateChange={setNotifTypesState}
            extraTypeItem={
              <div
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3.5 transition-all',
                  settings.sla_breach_alert ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                )}
              >
                <div className={cn('rounded-lg p-2 shrink-0', settings.sla_breach_alert ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">SLA Breach Alert</p>
                  <p className="text-xs text-muted-foreground">Notify when a case is at risk of breaching its SLA</p>
                </div>
                <Switch
                  checked={settings.sla_breach_alert}
                  onCheckedChange={(v) => set({ sla_breach_alert: v })}
                  aria-label={`Turn SLA breach alert ${settings.sla_breach_alert ? 'off' : 'on'}`}
                  className="shrink-0"
                />
              </div>
            }
          />

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                if (generalDirty) saveMutation.mutate()
                if (notifTypesState.isDirty) notifTypesRef.current?.save()
              }}
              disabled={!notificationsIsDirty || notificationsIsPending}
            >
              <Save className="h-4 w-4" />
              {notificationsIsPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-4">
          <div className="rounded-xl border bg-card p-5 divide-y">
            <Field label="Session timeout (minutes)">
              <Input
                type="number"
                className="w-24 text-right"
                min={5}
                value={settings.session_timeout_minutes}
                onChange={(e) => set({ session_timeout_minutes: +e.target.value })}
              />
            </Field>
            <Field label="Max failed login attempts">
              <Input
                type="number"
                className="w-24 text-right"
                min={1}
                value={settings.max_login_attempts}
                onChange={(e) => set({ max_login_attempts: +e.target.value })}
              />
            </Field>
            <Field label="Require 2FA">
              <Switch checked={settings.require_2fa} onCheckedChange={(v) => set({ require_2fa: v })} />
            </Field>
          </div>
          <SaveChangesButton />
          <ChangePasswordCard />
        </TabsContent>

        {/* Maintenance */}
        <TabsContent value="maintenance" className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <Field label="Maintenance mode">
              <Switch checked={settings.maintenance_mode} onCheckedChange={(v) => set({ maintenance_mode: v })} />
            </Field>
            {settings.maintenance_mode && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <Label>Maintenance message</Label>
                  <Input
                    value={settings.maintenance_message}
                    onChange={(e) => set({ maintenance_message: e.target.value })}
                  />
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Warning: enabling maintenance mode will show a banner to all users.
                </p>
              </>
            )}
          </div>
          <SaveChangesButton />
        </TabsContent>
      </Tabs>
    </div>
  )
}