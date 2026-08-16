'use client'

import { useMemo, useState } from 'react'
import { MOCK_CONVERSATIONS, MOCK_MESSAGES } from '@/data/messaging'
import type { ChatMessage, Conversation } from '@/types/messaging'

// Frontend-only messaging state backed by mock data. Swap the initial state
// and the two mutators below for real API calls once a backend exists —
// the components consuming this hook don't need to change.
export function useMessaging() {
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS)
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ChatMessage[]>>(MOCK_MESSAGES)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

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
  }
}

export type UseMessagingReturn = ReturnType<typeof useMessaging>
