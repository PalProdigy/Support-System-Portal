'use client'

import { useState, useRef } from 'react'
import type { ComponentType } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { canAccess } from '@/lib/rbac'
import { EmptyState } from '@/components/shared/empty-state'
import type { NotificationPreferencesHandle } from '@/modules/shared/notification-preferences'
import { PersonalSettings, TeamLeadSettings } from '@/modules/shared/personal-settings'
import {
  Settings, Mail, MessageSquare, Bell, Smartphone, Shield, Save,
  Clock, CalendarClock, AlertTriangle, KeyRound, LogIn, ShieldCheck, Wrench,
} from 'lucide-react'

const STORAGE_KEY = 'nhq_system_settings'

interface SystemSettings {
  escalation_threshold_hours: number
  auto_close_days: number
  sla_breach_alert: boolean
  email_notifications: boolean
  sms_notifications: boolean
  whatsapp_notifications: boolean
  web_push_notifications: boolean
  session_timeout_minutes: number
  max_login_attempts: number
  require_2fa: boolean
  maintenance_mode: boolean
  maintenance_message: string
  // 'YYYY-MM-DD' (local), or null when no expiration is scheduled.
  // Reminders fire 20/10/5/1 days before this date — see
  // src/lib/security/password-expiry-runner.ts.
  password_expiration_date: string | null
}

function formatDDMMYY(dateKey: string): string {
  const [y, m, d] = dateKey.split('-')
  return `${d}/${m}/${y.slice(2)}`
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
    escalation_threshold_hours: 4,
    auto_close_days: 7,
    sla_breach_alert: true,
    email_notifications: true,
    sms_notifications: false,
    whatsapp_notifications: false,
    web_push_notifications: true,
    session_timeout_minutes: 60,
    max_login_attempts: 5,
    require_2fa: false,
    maintenance_mode: false,
    maintenance_message: 'The portal is currently under maintenance. Please check back later.',
    password_expiration_date: null,
  }
}

function Field({
  icon: Icon, label, description, children,
}: {
  icon?: ComponentType<{ className?: string }>
  label: React.ReactNode
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-accent/20 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="rounded-lg bg-primary/10 p-2 shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const session = useSession()

  if (session.role === 'technical_head') return <SystemSettingsView />

  if (session.role === 'team_lead' || session.role === 'support_engineer' || session.role === 'sales_executive') {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your appearance, security and notification preferences</p>
          </div>
        </div>
        {session.role === 'team_lead' ? <TeamLeadSettings /> : <PersonalSettings />}
      </div>
    )
  }

  return <EmptyState icon={Shield} title="Access Denied" description="You don't have access to settings." />
}

function SystemSettingsView() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()

  const scope = { userId: session.userId, role: session.role }
  const isAdmin = canAccess(scope, 'update', 'system_settings')

  const [settings, setSettings] = useState<SystemSettings>(loadSettings)
  const [savedSettings, setSavedSettings] = useState<SystemSettings>(loadSettings)
  const set = (patch: Partial<SystemSettings>) => setSettings((s) => ({ ...s, ...patch }))
  const generalDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings)

  const notifChannelsRef = useRef<NotificationPreferencesHandle>(null)
  const [notifChannelsState, setNotifChannelsState] = useState({ isDirty: false, isPending: false })

  const notifTypesRef = useRef<NotificationPreferencesHandle>(null)
  const [notifTypesState, setNotifTypesState] = useState({ isDirty: false, isPending: false })

  const [calendarOpen, setCalendarOpen] = useState(false)

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

  const notificationsCard = (
    <div className="space-y-2">
      <div className="rounded-xl border bg-card divide-y overflow-hidden">
        <Field icon={Mail} label="Email notifications">
          <Switch checked={settings.email_notifications} onCheckedChange={(v) => set({ email_notifications: v })} />
        </Field>
        <Field icon={Smartphone} label="SMS notifications">
          <Switch checked={settings.sms_notifications} onCheckedChange={(v) => set({ sms_notifications: v })} />
        </Field>
        <Field icon={MessageSquare} label="WhatsApp notifications">
          <Switch checked={settings.whatsapp_notifications} onCheckedChange={(v) => set({ whatsapp_notifications: v })} />
        </Field>
        <Field icon={Bell} label="Web push notifications">
          <Switch checked={settings.web_push_notifications} onCheckedChange={(v) => set({ web_push_notifications: v })} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground px-1">Email, SMS, WhatsApp and Web Push connectors plug in via ApiDataProvider in Phase 1.</p>
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
    <div className="px-6 pb-24 sm:pb-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Hero header */}
      <div className=" flex items-center justify-between gap-4 flex-wrap">
        <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="rounded-xl bg-primary/15 p-3 shrink-0">
            <Settings className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{isAdmin ? 'System Settings' : 'Notification Settings'}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isAdmin ? 'Configure portal-wide behaviour and integrations.' : 'Choose how you want to be notified.'}
            </p>
          </div>
        </div>
        <Button className="relative hidden sm:inline-flex" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {/* Mobile: Save Changes pinned to the bottom of the screen instead of the header */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:hidden">
        <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {!isAdmin ? (
        notificationsCard
      ) : (
        <Tabs defaultValue="general">
          <TabsList className="mb-4 grid h-auto w-full max-w-full grid-flow-col auto-cols-fr gap-1 p-1">
            <TabsTrigger value="general" className="w-full min-w-0 gap-1.5 truncate">
              <Settings className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">General</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="w-full min-w-0 gap-1.5 truncate">
              <Bell className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="w-full min-w-0 gap-1.5 truncate">
              <Shield className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Security</span>
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="w-full min-w-0 gap-1.5 truncate">
              <Wrench className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Maintenance</span>
            </TabsTrigger>
          </TabsList>

          {/* General */}
          <TabsContent value="general" className="space-y-4">
            <div className="rounded-xl border bg-card divide-y overflow-hidden">
              <Field icon={Clock} label="Escalation threshold" description="Hours before an unattended case escalates">
                <Input
                  type="number"
                  className="w-20 text-right"
                  min={1}
                  value={settings.escalation_threshold_hours}
                  onChange={(e) => set({ escalation_threshold_hours: +e.target.value })}
                />
              </Field>
              <Field icon={CalendarClock} label="Auto-close after resolved" description="Days before a resolved case closes automatically">
                <Input
                  type="number"
                  className="w-20 text-right"
                  min={1}
                  value={settings.auto_close_days}
                  onChange={(e) => set({ auto_close_days: +e.target.value })}
                />
              </Field>
              <Field icon={AlertTriangle} label="SLA breach alert" description="Notify the team when a case breaches its SLA">
                <Switch checked={settings.sla_breach_alert} onCheckedChange={(v) => set({ sla_breach_alert: v })} />
              </Field>
            </div>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications">
            {notificationsCard}
          </TabsContent>

          {/* Security */}
          <TabsContent value="security">
            <div className="rounded-xl border bg-card divide-y overflow-hidden">
              <Field icon={LogIn} label="Session timeout" description="Minutes of inactivity before automatic sign-out">
                <Input
                  type="number"
                  className="w-20 text-right"
                  min={5}
                  value={settings.session_timeout_minutes}
                  onChange={(e) => set({ session_timeout_minutes: +e.target.value })}
                />
              </Field>
              <Field icon={KeyRound} label="Max failed login attempts" description="Lock the account after this many failures">
                <Input
                  type="number"
                  className="w-20 text-right"
                  min={1}
                  value={settings.max_login_attempts}
                  onChange={(e) => set({ max_login_attempts: +e.target.value })}
                />
              </Field>
              <Field icon={ShieldCheck} label="Require 2FA" description="Enforce two-factor authentication for all users">
                <Switch checked={settings.require_2fa} onCheckedChange={(v) => set({ require_2fa: v })} />
              </Field>
            </div>
          </TabsContent>

          {/* Maintenance */}
          <TabsContent value="maintenance">
            <div className="rounded-xl border bg-card overflow-hidden">
              <Field icon={Wrench} label="Maintenance mode" description="Show a maintenance banner to all users">
                <Switch checked={settings.maintenance_mode} onCheckedChange={(v) => set({ maintenance_mode: v })} />
              </Field>
              {settings.maintenance_mode && (
                <div className="border-t px-5 py-4 space-y-3 bg-amber-500/5">
                  <div className="space-y-1.5">
                    <Label>Maintenance message</Label>
                    <Input
                      value={settings.maintenance_message}
                      onChange={(e) => set({ maintenance_message: e.target.value })}
                    />
                  </div>
                  <p className={cn('flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400')}>
                    <AlertTriangle className="h-3.5 w-3.5" /> Enabling maintenance mode will show a banner to all users.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
