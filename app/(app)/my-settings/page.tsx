'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { useSession } from '@/lib/auth/context'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { NotificationPreferences } from '@/modules/shared/notification-preferences'
import { ChangePasswordCard } from '@/modules/shared/change-password'
import { Settings, Moon, User, ArrowRight } from 'lucide-react'

function Guard() {
  const session = useSession()
  if (session.role !== 'support_engineer') redirect('/dashboard')
  return null
}

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

export default function MySettingsPage() {
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <Guard />
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your appearance and notification preferences</p>
        </div>
      </div>

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
    </div>
  )
}
