'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Label } from '@/components/ui/label'
import { IconField } from '@/components/shared/icon-field'
import { UserAvatar } from '@/components/shared/user-avatar'
import { User, Mail, Phone, Briefcase, IdCard, CalendarDays, UserPlus, UserX, X } from 'lucide-react'
import type { ProductManager } from '@/types'

const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `pm_${Date.now()}_${Math.random().toString(36).slice(2)}`

const EMPTY_DRAFT = { name: '', email: '', phone: '', designation: '', employee_id: '', joining_date: '' }

function matches(m: ProductManager, q: string) {
  const needle = q.toLowerCase()
  return (
    m.name.toLowerCase().includes(needle) ||
    m.email.toLowerCase().includes(needle) ||
    m.employee_id.toLowerCase().includes(needle)
  )
}

// Add/search UI for a product's Product Manager list — supports several
// managers per product. Typing searches managers already on file (across all
// products, passed in as `candidates`) so the same contact can be reused
// instead of re-entered; when nothing matches, it offers to create a new one
// inline using the same fields the old single-manager form had.
export function ProductManagerField({ managers, onChange, candidates }: {
  managers: ProductManager[]
  onChange: (managers: ProductManager[]) => void
  candidates: ProductManager[]
}) {
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)

  const addedIds = useMemo(() => new Set(managers.map((m) => m.id)), [managers])

  const results = useMemo(() => {
    const pool = candidates.filter((c) => !addedIds.has(c.id))
    const q = query.trim()
    return q ? pool.filter((c) => matches(c, q)) : pool
  }, [candidates, addedIds, query])

  function resetAddUi() {
    setAdding(false)
    setQuery('')
    setCreating(false)
    setDraft(EMPTY_DRAFT)
  }

  function selectExisting(m: ProductManager) {
    onChange([...managers, m])
    resetAddUi()
  }

  function removeManager(id: string) {
    onChange(managers.filter((m) => m.id !== id))
  }

  function startCreate() {
    setCreating(true)
    setDraft({ ...EMPTY_DRAFT, name: query.trim() })
  }

  function saveCreated() {
    const name = draft.name.trim()
    if (!name) return
    onChange([...managers, { id: newId(), ...draft, name, email: draft.email.trim(), phone: draft.phone.trim(), designation: draft.designation.trim(), employee_id: draft.employee_id.trim() }])
    resetAddUi()
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-3.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Product Manager{managers.length > 1 ? 's' : ''}</Label>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <UserPlus className="h-3.5 w-3.5" /> Add
          </button>
        )}
      </div>

      {managers.length > 0 && (
        <div className="space-y-1.5">
          {managers.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 rounded-lg border bg-background px-2.5 py-2">
              <UserAvatar name={m.name} size="sm" border={false} shadow={false} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight text-foreground truncate">{m.name}</p>
                <p className="text-[11px] leading-tight text-muted-foreground truncate">
                  {[m.designation, m.email].filter(Boolean).join(' · ') || 'Product Manager'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeManager(m.id)}
                className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {managers.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">No product manager added yet.</p>
      )}

      {adding && !creating && (
        <div className="space-y-2 rounded-lg border bg-background p-2.5">
          <div className="flex items-center gap-2">
            <SearchInput
              containerClassName="flex-1"
              value={query}
              onChange={setQuery}
              debounceMs={150}
              placeholder="Search by name, email, or employee ID…"
              autoFocus
              className="h-9"
            />
            <button type="button" onClick={resetAddUi} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent" title="Cancel">
              <X className="h-4 w-4" />
            </button>
          </div>

          {results.length > 0 ? (
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {results.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectExisting(m)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                >
                  <UserAvatar name={m.name} size="sm" border={false} shadow={false} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight text-foreground truncate">{m.name}</p>
                    <p className="text-[11px] leading-tight text-muted-foreground truncate">
                      {[m.designation, m.email].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-1 py-1.5 text-xs text-muted-foreground">
              <UserX className="h-3.5 w-3.5 shrink-0" />
              {query.trim() ? <>No product manager found for &ldquo;{query.trim()}&rdquo;.</> : 'No other product managers on file yet.'}
            </div>
          )}

          <Button type="button" variant="outline" size="sm" className="w-full h-8" onClick={startCreate}>
            <UserPlus className="h-3.5 w-3.5" />
            {query.trim() ? <>Create &ldquo;{query.trim()}&rdquo; as new product manager</> : 'Create new product manager'}
          </Button>
        </div>
      )}

      {adding && creating && (
        <div className="space-y-3 rounded-lg border bg-background p-2.5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <UserPlus className="h-3 w-3" /> New product manager
            </p>
            <button type="button" onClick={resetAddUi} className="rounded-md p-1 text-muted-foreground hover:bg-accent" title="Cancel">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <IconField icon={User} label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Full name" />
          <IconField icon={Mail} label="Email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="email@company.com" />
          <div className="grid grid-cols-2 gap-3">
            <IconField icon={Phone} label="Mobile Number" type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+880 …" />
            <IconField icon={Briefcase} label="Designation" value={draft.designation} onChange={(e) => setDraft({ ...draft, designation: e.target.value })} placeholder="Product Manager" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <IconField icon={IdCard} label="Employee ID" value={draft.employee_id} onChange={(e) => setDraft({ ...draft, employee_id: e.target.value })} placeholder="EMP-1024" />
            <IconField icon={CalendarDays} label="Joining Date" type="date" value={draft.joining_date} onChange={(e) => setDraft({ ...draft, joining_date: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button type="button" size="sm" className="flex-1 h-8" disabled={!draft.name.trim()} onClick={saveCreated}>Add</Button>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={resetAddUi}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}
