'use client'

import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EmptyState } from '@/components/shared/empty-state'
import { UserAvatar } from '@/components/shared/user-avatar'
import type { Group } from '@/types/messaging'

interface GroupsListProps {
  groups: Group[]
  onOpenGroup: (id: string) => void
  onNewGroup: () => void
}

export function GroupsList({ groups, onOpenGroup, onNewGroup }: GroupsListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">All Groups</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {groups.length} {groups.length === 1 ? 'group' : 'groups'}
          </p>
        </div>
        <Button size="sm" onClick={onNewGroup}>
          <Plus className="h-3.5 w-3.5" />
          New Group
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {groups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No groups yet"
            description="Create a group to start messaging multiple people at once."
            action={{ label: 'New Group', onClick: onNewGroup }}
          />
        ) : (
          <div className="flex flex-col">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onOpenGroup(g.id)}
                className="flex items-center gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-accent/60"
              >
                <UserAvatar name={g.name} avatarUrl={g.avatarUrl} userId={g.id} size="md" shadow={false} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{g.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.memberIds.length} {g.memberIds.length === 1 ? 'member' : 'members'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
