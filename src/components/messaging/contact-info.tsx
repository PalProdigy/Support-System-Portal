'use client'

import { ArrowLeft, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { UserAvatar } from '@/components/shared/user-avatar'
import { cn } from '@/lib/utils'
import { THEME_COLORS } from './theme-colors'

interface ContactInfoProps {
  userId: string
  name: string
  avatarUrl?: string
  themeColor?: string
  onBack: () => void
  onChangeTheme: (themeColor: string | undefined) => void
}

export function ContactInfo({ userId, name, avatarUrl, themeColor, onBack, onChangeTheme }: ContactInfoProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2.5 border-b px-3 py-2.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack} aria-label="Back to chat">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-semibold text-foreground">Contact Info</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col items-center gap-3 border-b px-4 py-6">
          <UserAvatar name={name} avatarUrl={avatarUrl} userId={userId} size="xl" shadow={false} />
          <p className="text-base font-semibold text-foreground">{name}</p>
        </div>

        <div className="px-4 py-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Theme</p>
          <div className="flex flex-wrap gap-2.5">
            {THEME_COLORS.map((t) => {
              const selected = themeColor === t.value
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onChangeTheme(t.value)}
                  aria-label={t.label}
                  title={t.label}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-105',
                    selected ? 'border-foreground' : 'border-transparent',
                  )}
                  style={{ backgroundColor: t.value ?? 'hsl(var(--primary))' }}
                >
                  {selected && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              )
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
