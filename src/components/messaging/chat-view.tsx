'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Camera, File as FileIcon, MessageCircle, Paperclip, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EmptyState } from '@/components/shared/empty-state'
import { UserAvatar } from '@/components/shared/user-avatar'
import { cn } from '@/lib/utils'
import type { Attachment, ChatMessage, Conversation } from '@/types/messaging'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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
  onSend: (body: string, attachment?: Attachment) => void
  onAvatarClick?: () => void
  accentColor?: string
}

export function ChatView({ conversation, messages, onBack, onSend, onAvatarClick, accentColor }: ChatViewProps) {
  const [input, setInput] = useState('')
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, conversation.id])

  useEffect(() => {
    if (!cameraOpen) return
    let cancelled = false
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => {
        if (!cancelled) setCameraError('Could not access the camera. Check permissions and try again.')
      })
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [cameraOpen])

  function submit() {
    const body = input.trim()
    if (!body && !pendingAttachment) return
    onSend(body, pendingAttachment ?? undefined)
    setInput('')
    setPendingAttachment(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setPendingAttachment({ name: file.name, url: reader.result as string, type: file.type, size: file.size })
    }
    reader.readAsDataURL(file)
  }

  function removePendingAttachment() {
    setPendingAttachment(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function openCamera() {
    setCameraError(null)
    setCameraOpen(true)
  }

  function capturePhoto() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    const size = Math.round(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4)
    setPendingAttachment({ name: `photo-${Date.now()}.jpg`, url: dataUrl, type: 'image/jpeg', size })
    setCameraOpen(false)
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
        {onAvatarClick ? (
          <button
            type="button"
            onClick={onAvatarClick}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left transition-colors"
            aria-label={conversation.isGroup ? 'Open group info' : 'Open contact info'}
          >
            <div className="relative shrink-0">
              <UserAvatar name={conversation.name} avatarUrl={conversation.avatarUrl} userId={conversation.id} size="sm" shadow={false} />
              {!conversation.isGroup && conversation.online && (
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-foreground">{conversation.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {conversation.isGroup ? 'Tap for group info' : 'Tap for contact info'}
              </p>
            </div>
          </button>
        ) : (
          <>
            <div className="relative shrink-0">
              <UserAvatar name={conversation.name} avatarUrl={conversation.avatarUrl} userId={conversation.id} size="sm" shadow={false} />
              {conversation.online && (
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-foreground">{conversation.name}</p>
              <p className="text-[11px] text-muted-foreground">{conversation.online ? 'Online' : 'Offline'}</p>
            </div>
          </>
        )}
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
                          style={isMe && accentColor ? { backgroundColor: accentColor } : undefined}
                          className={cn(
                            'max-w-[75%] break-words rounded-2xl px-3 py-2 text-sm',
                            isMe
                              ? cn('rounded-br-sm text-white', !accentColor && 'bg-primary text-primary-foreground')
                              : 'rounded-bl-sm bg-muted text-foreground',
                          )}
                        >
                          {m.attachment && (
                            m.attachment.type.startsWith('image/') ? (
                              <img
                                src={m.attachment.url}
                                alt={m.attachment.name}
                                className="mb-1 max-h-52 w-full rounded-lg object-cover"
                              />
                            ) : (
                              <div
                                className={cn(
                                  'mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5',
                                  isMe ? 'bg-white/15' : 'bg-background',
                                )}
                              >
                                <FileIcon className="h-4 w-4 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-medium">{m.attachment.name}</p>
                                  <p className={cn('text-[10px]', isMe ? 'text-white/70' : 'text-muted-foreground')}>
                                    {formatFileSize(m.attachment.size)}
                                  </p>
                                </div>
                              </div>
                            )
                          )}
                          {m.body}
                          {j === cluster.length - 1 && (
                            <div className={cn('mt-0.5 text-[10px]', isMe ? 'text-white/70' : 'text-muted-foreground')}>
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

      <div className="flex shrink-0 flex-col gap-2 border-t px-3 py-2.5">
        {pendingAttachment && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-2.5 py-1.5">
            {pendingAttachment.type.startsWith('image/') ? (
              <img src={pendingAttachment.url} alt={pendingAttachment.name} className="h-9 w-9 shrink-0 rounded object-cover" />
            ) : (
              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{pendingAttachment.name}</p>
              <p className="text-[10px] text-muted-foreground">{formatFileSize(pendingAttachment.size)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={removePendingAttachment}
              aria-label="Remove attachment"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            aria-label="Attach file"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            aria-label="Take photo"
            onClick={openCamera}
          >
            <Camera className="h-4 w-4" />
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
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={submit}
            disabled={!input.trim() && !pendingAttachment}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Take a photo</DialogTitle>
          </DialogHeader>
          {cameraError ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{cameraError}</p>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full rounded-md bg-black object-cover"
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCameraOpen(false)}>
              Cancel
            </Button>
            <Button onClick={capturePhoto} disabled={!!cameraError}>
              <Camera className="mr-2 h-4 w-4" />
              Capture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
