'use client'

import { useRef, useState } from 'react'
import { ArrowLeft, Camera, Check, Pencil, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { UserAvatar } from '@/components/shared/user-avatar'
import { cn } from '@/lib/utils'
import type { Group } from '@/types/messaging'
import { THEME_COLORS } from './theme-colors'

interface GroupInfoProps {
  group: Group
  memberNames: string[]
  muted: boolean
  onBack: () => void
  onRename: (name: string) => void
  onChangePhoto: (avatarUrl: string) => void
  onChangeTheme: (themeColor: string | undefined) => void
  onToggleMute: (muted: boolean) => void
}

export function GroupInfo({
  group, memberNames, muted, onBack, onRename, onChangePhoto, onChangeTheme, onToggleMute,
}: GroupInfoProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(group.name)
  const [photoDraft, setPhotoDraft] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhotoDraft(reader.result as string)
    reader.readAsDataURL(file)
  }

  function confirmPhoto() {
    if (photoDraft) onChangePhoto(photoDraft)
    setPhotoDraft(null)
  }

  function cancelPhoto() {
    setPhotoDraft(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function startEdit() {
    setNameDraft(group.name)
    setEditingName(true)
  }

  function confirmEdit() {
    const trimmed = nameDraft.trim()
    if (trimmed) onRename(trimmed)
    setEditingName(false)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2.5 border-b px-3 py-2.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack} aria-label="Back to chat">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-semibold text-foreground">Group Info</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col items-center gap-3 border-b px-4 py-6">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative shrink-0 rounded-full"
            aria-label="Change group photo"
            disabled={!!photoDraft}
          >
            <UserAvatar name={group.name} avatarUrl={photoDraft ?? group.avatarUrl} userId={group.id} size="xl" shadow={false} />
            {!photoDraft && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                <Camera className="h-5 w-5" />
              </span>
            )}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

          {photoDraft && (
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={confirmPhoto} aria-label="Save photo">
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={cancelPhoto} aria-label="Cancel photo change">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {editingName ? (
            <div className="flex w-full max-w-[240px] items-center gap-1.5">
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="h-8 text-center"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmEdit()
                  if (e.key === 'Escape') setEditingName(false)
                }}
              />
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={confirmEdit} aria-label="Save name">
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditingName(false)} aria-label="Cancel edit">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-base font-semibold text-foreground hover:bg-accent/60"
            >
              {group.name}
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          <p className="text-xs text-muted-foreground">
            {memberNames.length} {memberNames.length === 1 ? 'member' : 'members'}
          </p>
        </div>

        <div className="border-b px-4 py-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Theme</p>
          <div className="flex flex-wrap gap-2.5">
            {THEME_COLORS.map((t) => {
              const selected = group.themeColor === t.value
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

        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Mute notifications</p>
              <p className="text-xs text-muted-foreground">Don&apos;t notify me for this group</p>
            </div>
            <Switch checked={muted} onCheckedChange={onToggleMute} />
          </div>
        </div>

        <div className="px-4 py-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Members
          </p>
          <ul className="space-y-2">
            {memberNames.map((name) => (
              <li key={name} className="flex items-center gap-2.5 text-sm text-foreground">
                <UserAvatar name={name} userId={name} size="sm" shadow={false} />
                {name}
              </li>
            ))}
          </ul>
        </div>
      </ScrollArea>
    </div>
  )
}
