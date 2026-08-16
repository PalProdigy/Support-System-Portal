export interface Conversation {
  id: string
  name: string
  avatarUrl?: string
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
  online?: boolean
  muted?: boolean
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: 'me' | string
  body: string
  sentAt: string
}
