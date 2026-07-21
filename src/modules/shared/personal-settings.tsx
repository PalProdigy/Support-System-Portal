'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NotificationPreferences } from '@/modules/shared/notification-preferences'
import { ChangePasswordCard } from '@/modules/shared/change-password'
import { Moon, User, ArrowRight, Settings, Shield, Bell } from 'lucide-react'

function AppearanceCard() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle(next: boolean) {
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('nhq_theme', next ? 'dark' : 'light')
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
            <Moon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Dark Mode</p>
            <p className="text-xs text-muted-foreground">Switch between light and dark appearance</p>
          </div>
        </div>
        <Switch checked={dark} onCheckedChange={toggle} aria-label="Toggle dark mode" />
      </div>
    </div>
  )
}

function AccountProfileCard() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <Link href="/profile" className="flex items-center justify-between gap-4 group">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
            <User className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Account & Profile</p>
            <p className="text-xs text-muted-foreground">View your profile, certifications and performance stats</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-primary group-hover:translate-x-0.5 transition-transform">
          View <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </div>
  )
}

// Personal settings hub shared by any role that doesn't manage org-wide
// System Settings (Technical Head) — appearance, password, and notification
// preferences, all scoped to the signed-in user.
export function PersonalSettings() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Appearance</h2>
        <AppearanceCard />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Security</h2>
        <ChangePasswordCard />
      </div>

      <div className="space-y-3">
        <NotificationPreferences />
      </div>

      <AccountProfileCard />
    </div>
  )
}

// Team Lead settings — same underlying cards as PersonalSettings, organized
// into General / Notifications / Security tabs.
export function TeamLeadSettings() {
  return (
    <Tabs defaultValue="general">
      <TabsList className="mb-4">
        <TabsTrigger value="general"><Settings className="h-3.5 w-3.5" /> General</TabsTrigger>
        <TabsTrigger value="notifications"><Bell className="h-3.5 w-3.5" /> Notifications</TabsTrigger>
        <TabsTrigger value="security"><Shield className="h-3.5 w-3.5" /> Security</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Appearance</h2>
          <AppearanceCard />
        </div>
        <AccountProfileCard />
        <NotificationPreferences section="channels" />
      </TabsContent>

      <TabsContent value="notifications">
        <NotificationPreferences section="types" />
      </TabsContent>

      <TabsContent value="security">
        <ChangePasswordCard />
      </TabsContent>
    </Tabs>
  )
}
