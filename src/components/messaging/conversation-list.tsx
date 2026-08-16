'use client'

import { BellOff, Info, Search, Settings, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  onOpenGroups?: () => void
  onOpenSettings?: () => void
}

export function ConversationList({
  conversations, search, onSearchChange, onSelect, activeId, onOpenGroups, onOpenSettings,
}: ConversationListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b px-4 pb-3 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Messages</h2>
          {(onOpenGroups || onOpenSettings) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="About">
                  <Info className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {onOpenGroups && (
                  <DropdownMenuItem onClick={onOpenGroups}>
                    <Users className="h-4 w-4" />
                    Groups
                  </DropdownMenuItem>
                )}
                {onOpenSettings && (
                  <DropdownMenuItem onClick={onOpenSettings}>
                    <Settings className="h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
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
                <UserAvatar name={c.name} avatarUrl={c.avatarUrl} userId={c.id} size="md" shadow={false} />
                {c.online && (
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                )}
                {c.isGroup && (
                  <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground ring-2 ring-card">
                    <Users className="h-2.5 w-2.5 text-card" />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('truncate text-sm text-foreground', c.unreadCount > 0 ? 'font-semibold' : 'font-medium')}>
                    {c.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                    {c.muted && <BellOff className="h-3 w-3" />}
                    {timeAgo(c.lastMessageAt)}
                  </span>
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
