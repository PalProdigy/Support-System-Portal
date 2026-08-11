'use client'

import { useState } from 'react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { UserAvatar } from '@/components/shared/user-avatar'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown, Search } from 'lucide-react'

export interface SearchableSelectOption {
  id: string
  label: string
  sublabel?: string
  /** Renders a UserAvatar instead of the field's leading icon, in both the trigger and each row. */
  avatarUrl?: string
}

// Searchable single-select dropdown — a Select/Combobox hybrid built on the
// existing Popover primitive (no cmdk dependency). Filters client-side as you type.
export function SearchableSelect({
  icon: Icon, label, required, options, value, onChange, placeholder = 'Select…', searchPlaceholder = 'Search…', emptyText = 'No results', triggerClassName,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label?: string
  required?: boolean
  options: SearchableSelectOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find((o) => o.id === value)
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
  const showAvatars = options.some((o) => o.avatarUrl !== undefined)

  return (
    <div className="space-y-1.5">
      {label && (
        <Label className="text-xs font-medium text-muted-foreground">
          {label}{required && <span className="text-destructive"> *</span>}
        </Label>
      )}
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery('') }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'group relative flex h-11 w-full items-center gap-2 rounded-xl border border-input bg-transparent pr-9 text-sm shadow-sm transition-all',
              showAvatars ? 'pl-2' : Icon ? 'pl-9' : 'pl-3',
              'hover:border-primary/40 hover:bg-accent/30',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50',
              open && 'border-primary/50 ring-2 ring-primary/40',
              triggerClassName
            )}
          >
            {!showAvatars && Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
            {showAvatars && selected && (
              <UserAvatar name={selected.label} avatarUrl={selected.avatarUrl} userId={selected.id} size="sm" />
            )}
            <span className="flex-1 min-w-0 flex items-baseline gap-1.5 text-left">
              <span className={cn('truncate', !selected && 'text-muted-foreground')}>
                {selected ? selected.label : placeholder}
              </span>
              {selected?.sublabel && (
                <span className="shrink-0 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                  {selected.sublabel}
                </span>
              )}
            </span>
            <ChevronsUpDown className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180 text-primary'
            )} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl shadow-lg" align="start">
          <div className="flex items-center gap-2 border-b px-3 py-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">{emptyText}</p>
            ) : (
              filtered.map((o) => {
                const isSelected = o.id === value
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => { onChange(o.id); setOpen(false); setQuery('') }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      isSelected ? 'bg-primary/10' : 'hover:bg-accent/60'
                    )}
                  >
                    {o.avatarUrl !== undefined && <UserAvatar name={o.label} avatarUrl={o.avatarUrl} userId={o.id} size="sm" />}
                    <span className="flex-1 min-w-0 truncate">{o.label}</span>
                    {o.sublabel && (
                      <span className="shrink-0 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {o.sublabel}
                      </span>
                    )}
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
