'use client'

import { useState } from 'react'
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
import { Settings, Mail, MessageSquare, Bell, Smartphone, Shield, Save } from 'lucide-react'

const STORAGE_KEY = 'nhq_system_settings'

interface SystemSettings {
  portal_name: string
  support_email: string
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
    escalation_threshold_hours: 4,
    auto_close_days: 7,
    sla_breach_alert: true,
    email_notifications: true,
    sms_notifications: false,
    whatsapp_notifications: false,
    web_push_notifications: false,
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
  const set = (patch: Partial<SystemSettings>) => setSettings((s) => ({ ...s, ...patch }))

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

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Settings</h1>
          <p className="text-sm text-muted-foreground">Configure portal-wide behaviour and integrations.</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="mb-4">
          <TabsTrigger value="general"><Settings className="h-3.5 w-3.5" /> General</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-3.5 w-3.5" /> Notifications</TabsTrigger>
          <TabsTrigger value="security"><Shield className="h-3.5 w-3.5" /> Security</TabsTrigger>
          <TabsTrigger value="maintenance"><Smartphone className="h-3.5 w-3.5" /> Maintenance</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general">
          <div className="rounded-xl border bg-card p-5 space-y-1 divide-y">
            <div className="space-y-1.5 pb-4">
              <Label>Portal Name</Label>
              <Input value={settings.portal_name} onChange={(e) => set({ portal_name: e.target.value })} />
            </div>
            <div className="space-y-1.5 py-4">
              <Label>Support Email</Label>
              <Input type="email" value={settings.support_email} onChange={(e) => set({ support_email: e.target.value })} />
            </div>
            <Field label="Escalation threshold (hours)">
              <Input
                type="number"
                className="w-24 text-right"
                min={1}
                value={settings.escalation_threshold_hours}
                onChange={(e) => set({ escalation_threshold_hours: +e.target.value })}
              />
            </Field>
            <Field label="Auto-close after resolved (days)">
              <Input
                type="number"
                className="w-24 text-right"
                min={1}
                value={settings.auto_close_days}
                onChange={(e) => set({ auto_close_days: +e.target.value })}
              />
            </Field>
            <Field label="SLA breach alert">
              <Switch checked={settings.sla_breach_alert} onCheckedChange={(v) => set({ sla_breach_alert: v })} />
            </Field>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <div className="rounded-xl border bg-card p-5 divide-y">
            <Field label={<span className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />Email notifications</span>}>
              <Switch checked={settings.email_notifications} onCheckedChange={(v) => set({ email_notifications: v })} />
            </Field>
            <Field label={<span className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-muted-foreground" />SMS notifications</span>}>
              <Switch checked={settings.sms_notifications} onCheckedChange={(v) => set({ sms_notifications: v })} />
            </Field>
            <Field label={<span className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-muted-foreground" />WhatsApp notifications</span>}>
              <Switch checked={settings.whatsapp_notifications} onCheckedChange={(v) => set({ whatsapp_notifications: v })} />
            </Field>
            <Field label={<span className="flex items-center gap-2"><Bell className="h-4 w-4 text-muted-foreground" />Web push notifications</span>}>
              <Switch checked={settings.web_push_notifications} onCheckedChange={(v) => set({ web_push_notifications: v })} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Email, SMS, WhatsApp and Web Push connectors plug in via ApiDataProvider in Phase 1.</p>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security">
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
        </TabsContent>

        {/* Maintenance */}
        <TabsContent value="maintenance">
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
        </TabsContent>
      </Tabs>
    </div>
  )
}