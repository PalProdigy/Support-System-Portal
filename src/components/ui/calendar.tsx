'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface CalendarProps {
  selected?: Date
  onSelect: (date: Date) => void
  /** Date keys ('YYYY-MM-DD', local) that should render a "has data" dot. */
  markedDates?: Set<string>
  className?: string
}

export function Calendar({ selected, onSelect, markedDates, className }: CalendarProps) {
  const [viewMonth, setViewMonth] = React.useState(() => {
    const base = selected ?? new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const today = new Date()
  const todayKey = toDateKey(today)
  const selectedKey = selected ? toDateKey(selected) : null

  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (Date | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ]

  return (
    <div className={cn('p-3 select-none', className)}>
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setViewMonth(new Date(year, month - 1, 1))}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">
          {viewMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          onClick={() => setViewMonth(new Date(year, month + 1, 1))}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="h-7 flex items-center justify-center text-[10px] font-semibold text-muted-foreground uppercase">
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`blank-${i}`} />
          const key = toDateKey(date)
          const isSelected = key === selectedKey
          const isToday = key === todayKey
          const hasData = markedDates?.has(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(date)}
              className={cn(
                'relative h-8 w-8 flex items-center justify-center rounded-md text-sm transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : isToday
                    ? 'border border-primary/50 text-foreground hover:bg-muted'
                    : 'text-foreground hover:bg-muted',
              )}
            >
              {date.getDate()}
              {hasData && (
                <span className={cn(
                  'absolute bottom-1 h-1 w-1 rounded-full',
                  isSelected ? 'bg-primary-foreground' : 'bg-primary',
                )} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
