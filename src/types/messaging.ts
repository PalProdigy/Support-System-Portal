export interface Conversation {
  id: string
  name: string
  avatarUrl?: string
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
  online?: boolean
  muted?: boolean
  isGroup?: boolean
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: 'me' | string
  body: string
  sentAt: string
}

export interface Contact {
  id: string
  name: string
}

export interface Group {
  id: string
  name: string
  avatarUrl?: string
  memberIds: string[]
  createdAt: string
  themeColor?: string
}
