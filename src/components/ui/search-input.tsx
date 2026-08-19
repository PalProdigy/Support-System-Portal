'use client'

import * as React from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'onKeyDown'> {
  /** Committed search value — drives filtering/fetching upstream. */
  value: string
  /** Called (debounced) as the user types; called immediately on Enter or clear. */
  onChange: (value: string) => void
  /** Debounce window in ms. ~150-250 for client-side filtering, ~300-400 for server-side search. */
  debounceMs?: number
  /** Minimum non-whitespace characters before a debounced search fires (default 0 = no threshold). Clearing the field or pressing Enter always bypasses this. */
  minChars?: number
  /** Shows a spinner in place of the clear icon — for server-side search only. */
  loading?: boolean
  /** Number of results currently showing, announced to screen readers via aria-live. */
  resultCount?: number
  resultLabel?: string
  containerClassName?: string
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      debounceMs = 250,
      minChars = 0,
      loading,
      resultCount,
      resultLabel = 'result',
      className,
      containerClassName,
      placeholder,
      ...props
    },
    ref
  ) => {
    const [draft, setDraft] = React.useState(value)
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    // Keep in sync with external resets (e.g. a "clear filters" action elsewhere).
    React.useEffect(() => {
      setDraft(value)
    }, [value])

    React.useEffect(() => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }, [])

    const clearTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    const handleInput = (next: string) => {
      setDraft(next)
      clearTimer()
      if (next === '') {
        onChange('')
        return
      }
      // Below the minimum-length threshold: leave existing results alone
      // (don't fire a broad 1-character search) until the user types more.
      if (next.trim().length < minChars) return
      timeoutRef.current = setTimeout(() => onChange(next), debounceMs)
    }

    const commitNow = () => {
      clearTimer()
      onChange(draft)
    }

    const handleClear = () => {
      clearTimer()
      setDraft('')
      onChange('')
    }

    return (
      <div className={cn('relative', containerClassName)}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={ref}
          type="text"
          value={draft}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitNow()
            }
          }}
          placeholder={placeholder}
          className={cn(
            'flex h-10 w-full rounded-lg border border-input bg-background pl-9 pr-9 text-sm text-foreground shadow-sm outline-none transition-all duration-200 ease-out',
            'placeholder:text-muted-foreground',
            'focus-visible:ring-0 focus-visible:border-primary/50 focus-visible:shadow-sm',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          {...props}
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : draft ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {typeof resultCount === 'number' && (
          <span className="sr-only" aria-live="polite">
            {resultCount} {resultLabel}{resultCount === 1 ? '' : 's'} found
          </span>
        )}
      </div>
    )
  }
)
SearchInput.displayName = 'SearchInput'
