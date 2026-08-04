'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { User as UserIcon, ThumbsUp, ThumbsDown, Reply, Trash2, Send, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLE_LABELS } from '@/lib/rbac'
import type { SolutionComment, Role } from '@/types'

// Minimal shape shared by Solution and SolutionArticle — the only fields these
// pure engagement helpers actually touch.
interface Reactable {
  likes?: string[]
  dislikes?: string[]
}

// Cap how deep replies keep indenting so very deep threads don't run off-screen.
const MAX_INDENT_DEPTH = 4

// Module-scope so the impure id/timestamp generation isn't evaluated during render.
// The id is a temporary client id used only for optimistic rendering; the real id
// is assigned by the data provider (mock or backend) and reconciled on refetch.
export function buildOptimisticComment(
  authorId: string, authorName: string, authorRole: Role, body: string, parentId: string | null,
): SolutionComment {
  return {
    id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    parent_id: parentId,
    author_id: authorId,
    author_name: authorName,
    author_role: authorRole,
    body: body.trim(),
    created_at: new Date().toISOString(),
    likes: [],
    dislikes: [],
  }
}

// Pure helpers that compute the toggled like/dislike arrays for optimistic UI.
export function applyLikeToggle(s: Reactable, uid: string): Partial<Reactable> {
  const likes = new Set(s.likes ?? [])
  const dislikes = new Set(s.dislikes ?? [])
  if (likes.has(uid)) { likes.delete(uid) } else { likes.add(uid); dislikes.delete(uid) }
  return { likes: [...likes], dislikes: [...dislikes] }
}
export function applyDislikeToggle(s: Reactable, uid: string): Partial<Reactable> {
  const likes = new Set(s.likes ?? [])
  const dislikes = new Set(s.dislikes ?? [])
  if (dislikes.has(uid)) { dislikes.delete(uid) } else { dislikes.add(uid); likes.delete(uid) }
  return { likes: [...likes], dislikes: [...dislikes] }
}

// Toggle a single comment's like/dislike (one active reaction per user).
export function applyCommentReaction(
  comments: SolutionComment[], commentId: string, uid: string, reaction: 'like' | 'dislike',
): SolutionComment[] {
  return comments.map((c) => {
    if (c.id !== commentId) return c
    const likes = new Set(c.likes ?? [])
    const dislikes = new Set(c.dislikes ?? [])
    if (reaction === 'like') {
      if (likes.has(uid)) { likes.delete(uid) } else { likes.add(uid); dislikes.delete(uid) }
    } else {
      if (dislikes.has(uid)) { dislikes.delete(uid) } else { dislikes.add(uid); likes.delete(uid) }
    }
    return { ...c, likes: [...likes], dislikes: [...dislikes] }
  })
}

// Remove a comment and every descendant reply (matches backend cascade behaviour).
export function removeCommentAndDescendants(comments: SolutionComment[], commentId: string): SolutionComment[] {
  const toRemove = new Set<string>()
  const collect = (cid: string) => {
    toRemove.add(cid)
    comments.filter((c) => (c.parent_id ?? null) === cid).forEach((child) => collect(child.id))
  }
  collect(commentId)
  return comments.filter((c) => !toRemove.has(c.id))
}

// Relative "2h ago" style timestamp. Module-scope so the impure Date.now() call
// isn't flagged as an impure-during-render violation.
export function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

// Recursive comment renderer — a reply is just a comment with a parent, so it
// renders itself for each of its children, giving every level the same actions.
export function CommentNode({
  comment, allComments, depth, currentUserId,
  onReact, onReply, onDelete, busyReact, busyReply, busyDelete,
}: {
  comment: SolutionComment
  allComments: SolutionComment[]
  depth: number
  currentUserId: string
  onReact: (commentId: string, reaction: 'like' | 'dislike') => void
  onReply: (parentId: string, body: string) => void
  onDelete: (commentId: string) => void
  busyReact: boolean
  busyReply: boolean
  busyDelete: boolean
}) {
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const children = allComments.filter((c) => (c.parent_id ?? null) === comment.id)
  const myReaction: 'like' | 'dislike' | null =
    (comment.likes ?? []).includes(currentUserId) ? 'like'
      : (comment.dislikes ?? []).includes(currentUserId) ? 'dislike'
        : null

  function submitReply() {
    const body = replyText.trim()
    if (!body) return
    onReply(comment.id, body)
    setReplyText('')
    setShowReply(false)
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 flex-wrap">
          <UserIcon className="h-3 w-3 shrink-0" />
          <span className="font-medium text-foreground">{comment.author_name}</span>
          {comment.author_role && (
            <span className="rounded bg-muted px-1.5 py-0.5">{ROLE_LABELS[comment.author_role] ?? comment.author_role}</span>
          )}
          <span>·</span>
          <span>{timeAgo(comment.created_at)}</span>
          {comment.author_id === currentUserId && (
            <button
              type="button"
              className="ml-auto hover:text-destructive disabled:opacity-50"
              disabled={busyDelete}
              onClick={() => onDelete(comment.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p className="text-sm break-words whitespace-pre-wrap">{comment.body}</p>

        <div className="flex items-center gap-1 mt-1 -ml-2 flex-wrap">
          <Button
            variant="ghost" size="sm" disabled={busyReact}
            className={cn('gap-1 px-2 h-7', myReaction === 'like' && 'text-primary')}
            onClick={() => onReact(comment.id, 'like')}
          >
            <ThumbsUp className="h-3 w-3" /> {(comment.likes ?? []).length}
          </Button>
          <Button
            variant="ghost" size="sm" disabled={busyReact}
            className={cn('gap-1 px-2 h-7', myReaction === 'dislike' && 'text-destructive')}
            onClick={() => onReact(comment.id, 'dislike')}
          >
            <ThumbsDown className="h-3 w-3" /> {(comment.dislikes ?? []).length}
          </Button>
          <Button variant="ghost" size="sm" className="gap-1 px-2 h-7" onClick={() => setShowReply((v) => !v)}>
            <Reply className="h-3 w-3" /> Reply
          </Button>
          {children.length > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 px-2 h-7" onClick={() => setCollapsed((v) => !v)}>
              {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
              {children.length} {children.length > 1 ? 'replies' : 'reply'}
            </Button>
          )}
        </div>

        {showReply && (
          <div className="flex items-end gap-2 mt-2">
            <Textarea
              rows={2}
              placeholder={`Reply to ${comment.author_name}...`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="flex-1"
            />
            <Button size="sm" disabled={busyReply || !replyText.trim()} onClick={submitReply}>
              <Send className="h-3 w-3" /> Reply
            </Button>
          </div>
        )}
      </div>

      {children.length > 0 && !collapsed && (
        <div className={cn('space-y-2', depth < MAX_INDENT_DEPTH ? 'ml-4 border-l pl-3' : 'pl-1')}>
          {children.map((child) => (
            <CommentNode
              key={child.id}
              comment={child}
              allComments={allComments}
              depth={depth + 1}
              currentUserId={currentUserId}
              onReact={onReact}
              onReply={onReply}
              onDelete={onDelete}
              busyReact={busyReact}
              busyReply={busyReply}
              busyDelete={busyDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
