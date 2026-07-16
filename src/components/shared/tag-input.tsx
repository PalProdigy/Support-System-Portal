'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { X, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'

const DEFAULT_MAX_TAGS = 5

function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
}

export interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  maxTags?: number
  disabled?: boolean
  className?: string
}

/**
 * Chip-style tag input: Enter or comma adds a tag, Backspace on an empty
 * field removes the last one. Tags are normalized to url-safe slugs.
 */
export function TagInput({
  value,
  onChange,
  placeholder = 'Add up to 5 tags…',
  maxTags = DEFAULT_MAX_TAGS,
  disabled = false,
  className,
}: TagInputProps) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function commitDraft() {
    const tag = normalizeTag(draft)
    setDraft('')
    if (!tag || value.includes(tag) || value.length >= maxTags) return
    onChange([...value, tag])
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitDraft()
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div
      className={cn(
        'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm',
        'focus-within:ring-1 focus-within:ring-ring cursor-text',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
        >
          <Hash className="h-3 w-3" aria-hidden />
          {tag}
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            className="ml-0.5 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={(e) => { e.stopPropagation(); onChange(value.filter((t) => t !== tag)) }}
            disabled={disabled}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {value.length < maxTags && (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          placeholder={value.length === 0 ? placeholder : ''}
          aria-label="Add tag"
          className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      )}
    </div>
  )
}
