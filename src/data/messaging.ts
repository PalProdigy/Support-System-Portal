import type { ChatMessage, Contact, Conversation, Group } from '@/types/messaging'

// Fixed at module load so timestamps stay stable for the lifetime of the tab
// instead of drifting on every render.
const NOW = Date.now()
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString()
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString()

export const MOCK_CONVERSATIONS: Conversation[] = [
  { id: 'c1', name: 'Rahim Uddin', unreadCount: 2, online: true, lastMessage: 'Hey, are you available for a quick call?', lastMessageAt: minutesAgo(2) },
  { id: 'c2', name: 'Karim Chowdhury', unreadCount: 0, online: true, lastMessage: "Let's discuss the project tomorrow.", lastMessageAt: minutesAgo(18) },
  { id: 'c3', name: 'Nusrat Jahan', unreadCount: 0, lastMessage: 'Thank you so much!', lastMessageAt: hoursAgo(1) },
  { id: 'c4', name: 'Sakib Hasan', unreadCount: 1, lastMessage: "I'll send it over tomorrow.", lastMessageAt: hoursAgo(3) },
  { id: 'c5', name: 'Support Team', unreadCount: 0, muted: true, isGroup: true, lastMessage: 'Ticket #4521 has been resolved.', lastMessageAt: hoursAgo(6) },
  { id: 'c6', name: 'Project Alpha Team', unreadCount: 4, isGroup: true, lastMessage: 'Farhana: Updated the deployment doc.', lastMessageAt: daysAgo(1) },
  { id: 'c7', name: 'Admin', unreadCount: 0, lastMessage: 'Your access request was approved.', lastMessageAt: daysAgo(2) },
  { id: 'c8', name: 'Development Team', unreadCount: 0, isGroup: true, lastMessage: 'Build passed on staging.', lastMessageAt: daysAgo(4) },
  { id: 'c9', name: 'Tanvir Islam', unreadCount: 0, lastMessage: 'Sure, sounds good.', lastMessageAt: daysAgo(6) },
]

// People selectable when creating a new group. Includes everyone already in
// a conversation plus a few colleagues not yet messaged.
export const MOCK_CONTACTS: Contact[] = [
  { id: 'c1', name: 'Rahim Uddin' },
  { id: 'c2', name: 'Karim Chowdhury' },
  { id: 'c3', name: 'Nusrat Jahan' },
  { id: 'c4', name: 'Sakib Hasan' },
  { id: 'c9', name: 'Tanvir Islam' },
  { id: 'contact-farhana', name: 'Farhana Begum' },
  { id: 'contact-imran', name: 'Imran Khan' },
  { id: 'contact-nasrin', name: 'Nasrin Akter' },
]

// The existing team conversations (c5, c6, c8) double as the seed groups
// shown under Groups > See Groups — id matches the conversation id so
// opening a group from that list opens its chat directly.
export const MOCK_GROUPS: Group[] = [
  { id: 'c5', name: 'Support Team', memberIds: ['contact-farhana', 'contact-imran', 'contact-nasrin'], createdAt: daysAgo(45) },
  { id: 'c6', name: 'Project Alpha Team', memberIds: ['c1', 'c2', 'contact-farhana'], createdAt: daysAgo(60) },
  { id: 'c8', name: 'Development Team', memberIds: ['c4', 'contact-imran', 'c9'], createdAt: daysAgo(90) },
]

export const MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  c1: [
    { id: 'c1-m1', conversationId: 'c1', senderId: 'c1', body: 'Hi! Do you have a minute today?', sentAt: daysAgo(1) },
    { id: 'c1-m2', conversationId: 'c1', senderId: 'me', body: "Sure, what's up?", sentAt: daysAgo(1) },
    { id: 'c1-m3', conversationId: 'c1', senderId: 'c1', body: 'Wanted to check on the case escalation from yesterday.', sentAt: daysAgo(1) },
    { id: 'c1-m4', conversationId: 'c1', senderId: 'me', body: "I'm on it, should have an update by EOD.", sentAt: hoursAgo(20) },
    { id: 'c1-m5', conversationId: 'c1', senderId: 'c1', body: 'Great, thanks!', sentAt: hoursAgo(19) },
    { id: 'c1-m6', conversationId: 'c1', senderId: 'c1', body: 'Hey, are you available for a quick call?', sentAt: minutesAgo(2) },
  ],
  c2: [
    { id: 'c2-m1', conversationId: 'c2', senderId: 'c2', body: "Let's discuss the project tomorrow.", sentAt: minutesAgo(18) },
    { id: 'c2-m2', conversationId: 'c2', senderId: 'me', body: 'Works for me, 10am?', sentAt: minutesAgo(16) },
  ],
  c3: [
    { id: 'c3-m1', conversationId: 'c3', senderId: 'me', body: 'Sent over the report you asked for.', sentAt: hoursAgo(2) },
    { id: 'c3-m2', conversationId: 'c3', senderId: 'c3', body: 'Thank you so much!', sentAt: hoursAgo(1) },
  ],
  c4: [
    { id: 'c4-m1', conversationId: 'c4', senderId: 'c4', body: "I'll send it over tomorrow.", sentAt: hoursAgo(3) },
  ],
  c5: [
    { id: 'c5-m1', conversationId: 'c5', senderId: 'c5', body: 'Ticket #4521 has been resolved.', sentAt: hoursAgo(6) },
  ],
  c6: [
    { id: 'c6-m1', conversationId: 'c6', senderId: 'c6', body: 'Farhana: Updated the deployment doc.', sentAt: daysAgo(1) },
  ],
  c7: [
    { id: 'c7-m1', conversationId: 'c7', senderId: 'c7', body: 'Your access request was approved.', sentAt: daysAgo(2) },
  ],
  c8: [
    { id: 'c8-m1', conversationId: 'c8', senderId: 'c8', body: 'Build passed on staging.', sentAt: daysAgo(4) },
  ],
  c9: [],
}
