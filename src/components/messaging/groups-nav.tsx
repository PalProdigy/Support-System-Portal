'use client'

import { ArrowLeft, Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface GroupsNavProps {
  active: 'newGroup' | 'groupsList'
  onSelectNew: () => void
  onSelectList: () => void
  onBack: () => void
}

export function GroupsNav({ active, onSelectNew, onSelectList, onBack }: GroupsNavProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-4">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack} aria-label="Back to messages">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-semibold text-foreground">Groups</h2>
      </div>

      <div className="flex flex-col gap-1 p-2">
        <button
          type="button"
          onClick={onSelectNew}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent/60',
            active === 'newGroup' && 'bg-accent',
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Plus className="h-4 w-4" />
          </span>
          New Group
        </button>
        <button
          type="button"
          onClick={onSelectList}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent/60',
            active === 'groupsList' && 'bg-accent',
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="h-4 w-4" />
          </span>
          See Groups
        </button>
      </div>
    </div>
  )
}
