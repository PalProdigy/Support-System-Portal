'use client'

import { cn } from '@/lib/utils'
import { Star } from 'lucide-react'

const ACCENT: Record<number, string> = {
  0: 'bg-muted-foreground/15',
  1: 'bg-red-400',
  2: 'bg-red-400',
  3: 'bg-amber-400',
  4: 'bg-emerald-400',
  5: 'bg-emerald-400',
}

export function QuestionRatingRow({
  index, label, value, onChange, size = 'md',
}: {
  index?: number
  label: string
  value: number
  onChange: (v: number) => void
  size?: 'sm' | 'md'
}) {
  const starSize = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'
  const answered = value > 0

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 overflow-hidden rounded-xl border pl-4 pr-3 py-3 transition-all',
        answered ? 'border-primary/20 bg-card shadow-sm' : 'border-border/60 bg-muted/20 hover:border-border'
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1 transition-colors', ACCENT[value] ?? ACCENT[0])} />

      {index != null && (
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums transition-all',
            answered ? 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm' : 'bg-muted-foreground/10 text-muted-foreground'
          )}
        >
          {index}
        </span>
      )}
      <p className="flex-1 min-w-0 text-sm leading-relaxed text-foreground pt-0.5">{label}</p>
      <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? 0 : n)}
            className="transition-transform hover:scale-125 active:scale-90"
          >
            <Star
              className={cn(
                starSize,
                'transition-colors',
                n <= value ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]' : 'text-muted-foreground/25 hover:text-amber-300'
              )}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
