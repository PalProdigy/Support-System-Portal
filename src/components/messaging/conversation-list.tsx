'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EmptyState } from '@/components/shared/empty-state'
import { UserAvatar } from '@/components/shared/user-avatar'
import { cn, timeAgo } from '@/lib/utils'
import type { Conversation } from '@/types/messaging'

interface ConversationListProps {
  conversations: Conversation[]
  search: string
  onSearchChange: (value: string) => void
  onSelect: (id: string) => void
  activeId?: string | null
}

export function ConversationList({ conversations, search, onSearchChange, onSelect, activeId }: ConversationListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b px-4 pb-3 pt-4">
        <h2 className="mb-3 text-base font-semibold text-foreground">Messages</h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="h-9 pl-8"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {conversations.length === 0 ? (
          <EmptyState icon={Search} title="No conversations found" description="Try a different search term." size="sm" />
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                'flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent/60',
                c.id === activeId && 'bg-accent',
              )}
            >
              <div className="relative shrink-0">
                <UserAvatar name={c.name} userId={c.id} size="md" shadow={false} />
                {c.online && (
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('truncate text-sm text-foreground', c.unreadCount > 0 ? 'font-semibold' : 'font-medium')}>
                    {c.name}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(c.lastMessageAt)}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className={cn('truncate text-xs', c.unreadCount > 0 ? 'text-foreground/80' : 'text-muted-foreground')}>
                    {c.lastMessage}
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {c.unreadCount > 9 ? '9+' : c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  )
}
