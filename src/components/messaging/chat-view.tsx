'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, MessageCircle, Paperclip, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EmptyState } from '@/components/shared/empty-state'
import { UserAvatar } from '@/components/shared/user-avatar'
import { cn } from '@/lib/utils'
import type { ChatMessage, Conversation } from '@/types/messaging'

function bubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function dateLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Consecutive messages from the same sender collapse into one visual cluster;
// each cluster is bucketed under the date-separator it falls on.
function groupMessages(messages: ChatMessage[]): { dateKey: string; clusters: ChatMessage[][] }[] {
  const groups: { dateKey: string; clusters: ChatMessage[][] }[] = []
  for (const m of messages) {
    const label = dateLabel(m.sentAt)
    let group = groups[groups.length - 1]?.dateKey === label ? groups[groups.length - 1] : undefined
    if (!group) {
      group = { dateKey: label, clusters: [] }
      groups.push(group)
    }
    const lastCluster = group.clusters[group.clusters.length - 1]
    if (lastCluster && lastCluster[0].senderId === m.senderId) {
      lastCluster.push(m)
    } else {
      group.clusters.push([m])
    }
  }
  return groups
}

interface ChatViewProps {
  conversation: Conversation
  messages: ChatMessage[]
  onBack?: () => void
  onSend: (body: string) => void
}

export function ChatView({ conversation, messages, onBack, onSend }: ChatViewProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, conversation.id])

  function submit() {
    const body = input.trim()
    if (!body) return
    onSend(body)
    setInput('')
  }

  const groups = groupMessages(messages)

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2.5 border-b px-3 py-2.5">
        {onBack && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack} aria-label="Back to conversations">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="relative shrink-0">
          <UserAvatar name={conversation.name} userId={conversation.id} size="sm" shadow={false} />
          {conversation.online && (
            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">{conversation.name}</p>
          <p className="text-[11px] text-muted-foreground">{conversation.online ? 'Online' : 'Offline'}</p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex min-h-full flex-col gap-3 px-3 py-4">
          {messages.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="Start a conversation"
              description={`Send a message to start chatting with ${conversation.name}.`}
              className="flex-1"
              size="sm"
            />
          ) : (
            groups.map((group) => (
              <div key={group.dateKey} className="flex flex-col gap-3">
                <div className="flex items-center justify-center">
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {group.dateKey}
                  </span>
                </div>
                {group.clusters.map((cluster, i) => {
                  const isMe = cluster[0].senderId === 'me'
                  return (
                    <div key={i} className={cn('flex flex-col gap-0.5', isMe ? 'items-end' : 'items-start')}>
                      {cluster.map((m, j) => (
                        <div
                          key={m.id}
                          className={cn(
                            'max-w-[75%] break-words rounded-2xl px-3 py-2 text-sm',
                            isMe
                              ? 'rounded-br-sm bg-primary text-primary-foreground'
                              : 'rounded-bl-sm bg-muted text-foreground',
                          )}
                        >
                          {m.body}
                          {j === cluster.length - 1 && (
                            <div className={cn('mt-0.5 text-[10px]', isMe ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                              {bubbleTime(m.sentAt)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex shrink-0 items-center gap-2 border-t px-3 py-2.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" aria-label="Attach file" disabled>
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Write a message..."
          className="h-9 flex-1"
        />
        <Button size="icon" className="h-9 w-9 shrink-0" onClick={submit} disabled={!input.trim()} aria-label="Send message">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
