'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'

interface SettingRowProps {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function SettingRow({ label, description, checked, onCheckedChange }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

export function SettingsPanel() {
  const [showOnlineStatus, setShowOnlineStatus] = useState(true)
  const [readReceipts, setReadReceipts] = useState(true)
  const [notificationSound, setNotificationSound] = useState(true)

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">Settings</h2>
      </div>
      <div className="divide-y px-4">
        <SettingRow
          label="Show online status"
          description="Let others see when you're active"
          checked={showOnlineStatus}
          onCheckedChange={setShowOnlineStatus}
        />
        <SettingRow
          label="Read receipts"
          description="Show when you've read a message"
          checked={readReceipts}
          onCheckedChange={setReadReceipts}
        />
        <SettingRow
          label="Notification sound"
          description="Play a sound for new messages"
          checked={notificationSound}
          onCheckedChange={setNotificationSound}
        />
      </div>
    </div>
  )
}
