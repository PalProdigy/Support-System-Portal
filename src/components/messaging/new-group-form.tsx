'use client'

import { useRef, useState } from 'react'
import { Camera, Check, Search, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { UserAvatar } from '@/components/shared/user-avatar'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types/messaging'

interface NewGroupFormProps {
  contacts: Contact[]
  onCreate: (input: { name: string; memberIds: string[]; avatarUrl?: string }) => void
  onCancel: () => void
}

export function NewGroupForm({ contacts, onCreate, onCancel }: NewGroupFormProps) {
  const [name, setName] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(memberSearch.trim().toLowerCase()),
  )

  function toggleMember(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAvatarUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  const canCreate = name.trim().length > 0 && selectedIds.length > 0

  function submit() {
    if (!canCreate) return
    onCreate({ name: name.trim(), memberIds: selectedIds, avatarUrl })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">New Group</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-5 p-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative shrink-0 rounded-full"
              aria-label="Set group photo"
            >
              <UserAvatar name={name || 'New Group'} avatarUrl={avatarUrl} userId="new-group" size="xl" shadow={false} />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                <Camera className="h-5 w-5" />
              </span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Group name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Client Escalations"
                className="h-9"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Add members</label>
              {selectedIds.length > 0 && (
                <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
              )}
            </div>

            {selectedIds.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selectedIds.map((id) => {
                  const contact = contacts.find((c) => c.id === id)
                  if (!contact) return null
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleMember(id)}
                      className="flex items-center gap-1 rounded-full bg-accent py-1 pl-2.5 pr-1.5 text-xs font-medium text-foreground hover:bg-accent/70"
                    >
                      {contact.name}
                      <X className="h-3 w-3" />
                    </button>
                  )
                })}
              </div>
            )}

            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search people..."
                className="h-9 pl-8"
              />
            </div>

            <div className="rounded-lg border">
              {filteredContacts.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No people found</p>
              ) : (
                filteredContacts.map((contact) => {
                  const selected = selectedIds.includes(contact.id)
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => toggleMember(contact.id)}
                      className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-0 hover:bg-accent/60"
                    >
                      <UserAvatar name={contact.name} userId={contact.id} size="sm" shadow={false} />
                      <span className="flex-1 text-sm text-foreground">{contact.name}</span>
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                        )}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={submit} disabled={!canCreate}>
          <Users className="h-4 w-4" />
          Create Group
        </Button>
      </div>
    </div>
  )
}
