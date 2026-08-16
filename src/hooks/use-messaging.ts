'use client'

import { useMemo, useState } from 'react'
import { MOCK_CONTACTS, MOCK_CONVERSATIONS, MOCK_GROUPS, MOCK_MESSAGES } from '@/data/messaging'
import type { ChatMessage, Conversation, Group } from '@/types/messaging'

export type MessagingOverlay = 'newGroup' | 'groupsList' | 'settings' | null

// Frontend-only messaging state backed by mock data. Swap the initial state
// and the mutators below for real API calls once a backend exists — the
// components consuming this hook don't need to change.
export function useMessaging() {
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS)
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ChatMessage[]>>(MOCK_MESSAGES)
  const [groups, setGroups] = useState<Group[]>(MOCK_GROUPS)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [overlay, setOverlay] = useState<MessagingOverlay>(null)

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => c.name.toLowerCase().includes(q))
  }, [conversations, search])

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null
  const activeMessages = activeId ? messagesByConversation[activeId] ?? [] : []
  const unreadTotal = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  function selectConversation(id: string) {
    setActiveId(id)
    setOverlay(null)
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)))
  }

  function closeConversation() {
    setActiveId(null)
  }

  function sendMessage(body: string) {
    if (!activeId) return
    const message: ChatMessage = {
      id: `local-${Date.now()}`,
      conversationId: activeId,
      senderId: 'me',
      body,
      sentAt: new Date().toISOString(),
    }
    setMessagesByConversation((prev) => ({
      ...prev,
      [activeId]: [...(prev[activeId] ?? []), message],
    }))
    setConversations((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, lastMessage: body, lastMessageAt: message.sentAt } : c)),
    )
  }

  function openGroupsList() {
    setOverlay('groupsList')
  }

  function openNewGroupForm() {
    setOverlay('newGroup')
  }

  function openSettings() {
    setOverlay('settings')
  }

  function closeOverlay() {
    setOverlay(null)
  }

  function createGroup(input: { name: string; memberIds: string[]; avatarUrl?: string }) {
    const id = `group-${Date.now()}`
    const now = new Date().toISOString()
    const group: Group = { id, name: input.name, avatarUrl: input.avatarUrl, memberIds: input.memberIds, createdAt: now }
    const conversation: Conversation = {
      id, name: input.name, avatarUrl: input.avatarUrl, isGroup: true,
      unreadCount: 0, lastMessage: 'Group created', lastMessageAt: now,
    }
    setGroups((prev) => [group, ...prev])
    setConversations((prev) => [conversation, ...prev])
    setMessagesByConversation((prev) => ({ ...prev, [id]: [] }))
    setOverlay(null)
    setActiveId(id)
  }

  return {
    conversations: filteredConversations,
    activeConversation,
    activeMessages,
    search,
    setSearch,
    selectConversation,
    closeConversation,
    sendMessage,
    unreadTotal,
    groups,
    contacts: MOCK_CONTACTS,
    overlay,
    openGroupsList,
    openNewGroupForm,
    openSettings,
    closeOverlay,
    createGroup,
  }
}

export type UseMessagingReturn = ReturnType<typeof useMessaging>
