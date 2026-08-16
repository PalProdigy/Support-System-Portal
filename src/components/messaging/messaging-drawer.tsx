'use client'

import { MessageCircle } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { EmptyState } from '@/components/shared/empty-state'
import { useIsMobile } from '@/hooks/use-is-mobile'
import type { UseMessagingReturn } from '@/hooks/use-messaging'
import { cn } from '@/lib/utils'
import { ChatView } from './chat-view'
import { ConversationList } from './conversation-list'
import { GroupsList } from './groups-list'
import { GroupsNav } from './groups-nav'
import { NewGroupForm } from './new-group-form'
import { SettingsPanel } from './settings-panel'

interface MessagingDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  messaging: UseMessagingReturn
}

export function MessagingDrawer({ open, onOpenChange, messaging }: MessagingDrawerProps) {
  const isMobile = useIsMobile()
  const {
    conversations, activeConversation, activeMessages,
    search, setSearch, selectConversation, closeConversation, sendMessage,
    groups, contacts, overlay, openGroupsList, openNewGroupForm, openSettings, closeOverlay, createGroup,
  } = messaging

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) {
      closeConversation()
      closeOverlay()
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex flex-col gap-0 p-0',
          // Mobile: fixed 70% viewport height so the sheet's proportions stay
          // constant rather than tracking the dynamic toolbar/keyboard.
          // Desktop: fixed 70% viewport width, split into a conversation list
          // and the active thread so both are visible at once.
          isMobile ? 'h-[70vh] max-h-[70vh] w-full' : 'h-full w-[70vw] max-w-[70vw]',
        )}
      >
        {isMobile && (
          <div className="flex shrink-0 justify-center pt-2">
            <span className="h-1.5 w-10 rounded-full bg-muted-foreground/25" />
          </div>
        )}

        {isMobile ? (
          <div className="min-h-0 flex-1">
            {activeConversation ? (
              <ChatView
                conversation={activeConversation}
                messages={activeMessages}
                onBack={closeConversation}
                onSend={sendMessage}
              />
            ) : (
              <ConversationList
                conversations={conversations}
                search={search}
                onSearchChange={setSearch}
                onSelect={selectConversation}
              />
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="w-[340px] shrink-0 border-r">
              {overlay === 'newGroup' || overlay === 'groupsList' ? (
                <GroupsNav
                  active={overlay}
                  onSelectNew={openNewGroupForm}
                  onSelectList={openGroupsList}
                  onBack={closeOverlay}
                />
              ) : (
                <ConversationList
                  conversations={conversations}
                  search={search}
                  onSearchChange={setSearch}
                  onSelect={selectConversation}
                  activeId={activeConversation?.id}
                  onOpenGroups={openGroupsList}
                  onOpenSettings={openSettings}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {overlay === 'newGroup' ? (
                <NewGroupForm contacts={contacts} onCreate={createGroup} onCancel={openGroupsList} />
              ) : overlay === 'groupsList' ? (
                <GroupsList groups={groups} onOpenGroup={selectConversation} onNewGroup={openNewGroupForm} />
              ) : overlay === 'settings' ? (
                <SettingsPanel />
              ) : activeConversation ? (
                <ChatView
                  conversation={activeConversation}
                  messages={activeMessages}
                  onSend={sendMessage}
                />
              ) : (
                <EmptyState
                  icon={MessageCircle}
                  title="Select a conversation"
                  description="Choose someone from the list to see your message history — previous, current, or start a new one."
                  className="h-full"
                />
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
