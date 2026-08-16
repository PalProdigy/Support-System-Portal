'use client'

import { useMemo, useState } from 'react'
import { MOCK_CONTACTS, MOCK_CONVERSATIONS, MOCK_GROUPS, MOCK_MESSAGES } from '@/data/messaging'
import type { Attachment, ChatMessage, Conversation, Group } from '@/types/messaging'

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
  const [infoPanelId, setInfoPanelId] = useState<string | null>(null)

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => c.name.toLowerCase().includes(q))
  }, [conversations, search])

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null
  const activeMessages = activeId ? messagesByConversation[activeId] ?? [] : []
  const activeGroup = activeConversation ? groups.find((g) => g.id === activeConversation.id) ?? null : null
  const infoPanelConversation = infoPanelId ? conversations.find((c) => c.id === infoPanelId) ?? null : null
  const groupInfoGroup = infoPanelConversation?.isGroup ? groups.find((g) => g.id === infoPanelId) ?? null : null
  const contactInfoConversation = infoPanelConversation && !infoPanelConversation.isGroup ? infoPanelConversation : null
  const unreadTotal = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  function selectConversation(id: string) {
    setActiveId(id)
    setOverlay(null)
    setInfoPanelId(null)
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)))
  }

  function closeConversation() {
    setActiveId(null)
  }

  function sendMessage(body: string, attachment?: Attachment) {
    if (!activeId) return
    if (!body && !attachment) return
    const message: ChatMessage = {
      id: `local-${Date.now()}`,
      conversationId: activeId,
      senderId: 'me',
      body,
      sentAt: new Date().toISOString(),
      attachment,
    }
    setMessagesByConversation((prev) => ({
      ...prev,
      [activeId]: [...(prev[activeId] ?? []), message],
    }))
    const preview = attachment ? body || `📎 ${attachment.name}` : body
    setConversations((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, lastMessage: preview, lastMessageAt: message.sentAt } : c)),
    )
  }

  function openGroupsList() {
    setOverlay('groupsList')
    setInfoPanelId(null)
  }

  function openNewGroupForm() {
    setOverlay('newGroup')
    setInfoPanelId(null)
  }

  function openSettings() {
    setOverlay('settings')
    setInfoPanelId(null)
  }

  function closeOverlay() {
    setOverlay(null)
  }

  function openInfoPanel(id: string) {
    setInfoPanelId(id)
  }

  function closeInfoPanel() {
    setInfoPanelId(null)
  }

  function updateConversationTheme(id: string, themeColor: string | undefined) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, themeColor } : c)))
  }

  function updateGroup(id: string, patch: { name?: string; avatarUrl?: string; themeColor?: string }) {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))
    if (patch.name !== undefined || patch.avatarUrl !== undefined) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}) }
            : c,
        ),
      )
    }
  }

  function toggleMuteConversation(id: string, muted: boolean) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, muted } : c)))
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
    setInfoPanelId(null)
    setActiveId(id)
  }

  return {
    conversations: filteredConversations,
    activeConversation,
    activeMessages,
    activeGroup,
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
    groupInfoGroup,
    contactInfoConversation,
    openInfoPanel,
    closeInfoPanel,
    updateGroup,
    updateConversationTheme,
    toggleMuteConversation,
  }
}

export type UseMessagingReturn = ReturnType<typeof useMessaging>
