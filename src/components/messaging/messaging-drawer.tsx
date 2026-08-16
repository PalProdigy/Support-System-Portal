'use client'

import { MessageCircle } from 'lucide-react'
import { Sheet, SheetClose, SheetContent } from '@/components/ui/sheet'
import { EmptyState } from '@/components/shared/empty-state'
import { useIsMobile } from '@/hooks/use-is-mobile'
import type { UseMessagingReturn } from '@/hooks/use-messaging'
import { cn } from '@/lib/utils'
import { ChatView } from './chat-view'
import { ContactInfo } from './contact-info'
import { ConversationList } from './conversation-list'
import { GroupInfo } from './group-info'
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
    conversations, activeConversation, activeMessages, activeGroup,
    search, setSearch, selectConversation, closeConversation, sendMessage,
    groups, contacts, overlay, openGroupsList, openNewGroupForm, openSettings, closeOverlay, createGroup,
    groupInfoGroup, contactInfoConversation, openInfoPanel, closeInfoPanel, updateGroup, updateConversationTheme,
    toggleMuteConversation,
  } = messaging

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) {
      closeConversation()
      closeOverlay()
      closeInfoPanel()
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        hideClose
        className={cn(
          'flex flex-col gap-0 p-0',
          // Mobile: fixed 70% viewport height so the sheet's proportions stay
          // constant rather than tracking the dynamic toolbar/keyboard.
          // Desktop: fixed 70% viewport width, split into a conversation list
          // and the active thread so both are visible at once.
          isMobile ? 'h-[70vh] max-h-[70vh] w-full' : 'h-full w-[70vw] max-w-[70vw]',
        )}
      >
        <SheetClose className="absolute right-3 top-3 z-10 rounded-md border border-red-600 bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 focus:outline-none ">
          Close
        </SheetClose>

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
              ) : groupInfoGroup ? (
                <GroupInfo
                  group={groupInfoGroup}
                  memberNames={groupInfoGroup.memberIds.map(
                    (id) => contacts.find((c) => c.id === id)?.name ?? id,
                  )}
                  muted={conversations.find((c) => c.id === groupInfoGroup.id)?.muted ?? false}
                  onBack={closeInfoPanel}
                  onRename={(name) => updateGroup(groupInfoGroup.id, { name })}
                  onChangePhoto={(avatarUrl) => updateGroup(groupInfoGroup.id, { avatarUrl })}
                  onChangeTheme={(themeColor) => updateGroup(groupInfoGroup.id, { themeColor })}
                  onToggleMute={(muted) => toggleMuteConversation(groupInfoGroup.id, muted)}
                />
              ) : contactInfoConversation ? (
                <ContactInfo
                  userId={contactInfoConversation.id}
                  name={contactInfoConversation.name}
                  avatarUrl={contactInfoConversation.avatarUrl}
                  themeColor={contactInfoConversation.themeColor}
                  onBack={closeInfoPanel}
                  onChangeTheme={(themeColor) => updateConversationTheme(contactInfoConversation.id, themeColor)}
                />
              ) : activeConversation ? (
                <ChatView
                  conversation={activeConversation}
                  messages={activeMessages}
                  onSend={sendMessage}
                  onAvatarClick={() => openInfoPanel(activeConversation.id)}
                  accentColor={activeConversation.isGroup ? activeGroup?.themeColor : activeConversation.themeColor}
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
