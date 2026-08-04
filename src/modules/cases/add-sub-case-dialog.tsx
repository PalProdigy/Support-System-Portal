'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { toast } from '@/hooks/use-toast'
import { canAssignSubCaseEngineer, ROLE_LABELS } from '@/lib/rbac'
import { cn } from '@/lib/utils'
import { X, UserPlus, Calendar as CalendarIcon, Clock } from 'lucide-react'
import type { Case, User } from '@/types'

function DateTimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [date, setDate] = useState<Date | undefined>(value ? new Date(value) : undefined)
  const [time, setTime] = useState(() => {
    if (!value) return ''
    const d = new Date(value)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  })
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (date && time) {
      const [h, m] = time.split(':').map(Number)
      const d = new Date(date)
      d.setHours(h || 0, m || 0, 0, 0)
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      onChange(local.toISOString().slice(0, 16))
    } else if (date) {
      const d = new Date(date)
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      onChange(local.toISOString().slice(0, 16))
    } else {
      onChange('')
    }
  }, [date, time])

  function formatDisplay(iso: string) {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('w-full justify-start text-left font-normal h-9', !value && 'text-muted-foreground')}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
          {value ? formatDisplay(value) : <span className="text-muted-foreground">{label}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 space-y-3">
          <Calendar
            selected={date}
            onSelect={(d) => {
              setDate(d)
              if (!time) setTime('12:00')
            }}
          />
          <div className="flex items-center gap-2 border-t pt-3">
            <Clock className="h-4 w-4 text-primary shrink-0" />
            <Select value={time.split(':')[0] || '12'} onValueChange={(h) => setTime(`${h}:${time.split(':')[1] || '00'}`)}>
              <SelectTrigger className="h-9 w-[80px]">
                <SelectValue placeholder="HH" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground text-sm">:</span>
            <Select value={time.split(':')[1] || '00'} onValueChange={(m) => setTime(`${time.split(':')[0] || '12'}:${m}`)}>
              <SelectTrigger className="h-9 w-[80px]">
                <SelectValue placeholder="MM" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setOpen(false)}>Done</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function AddSubCaseDialog({
  parentCase, open, onOpenChange,
}: {
  parentCase: Case
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }
  const canAssign = canAssignSubCaseEngineer(session.role)

  // The caller mounts this dialog only while `open` is true (see
  // SubCasesSection), so every open is a fresh instance — these initializers
  // seed the form instead of an effect.
  const [form, setForm] = useState({ title: '', started_at: '', estimated_end_at: '' })
  // Pre-select the parent's current assignee (if any) — TH/TL can add more or clear it.
  const [engineerIds, setEngineerIds] = useState<string[]>(parentCase.assignee_id ? [parentCase.assignee_id] : [])

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers(), enabled: canAssign })

  const eligibleEngineers = (users ?? []).filter((u) => ['support_engineer', 'team_lead'].includes(u.role) && u.is_active)
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))
  const selectedEngineers = engineerIds.map((id) => usersMap[id]).filter(Boolean)
  const availableEngineers = eligibleEngineers.filter((u) => !engineerIds.includes(u.id))

  const createM = useMutation({
    mutationFn: () => {
      const startedAt = form.started_at ? new Date(form.started_at).toISOString() : undefined
      const estimatedEndAt = form.estimated_end_at ? new Date(form.estimated_end_at).toISOString() : undefined
      return dp.createSubCase(
        parentCase.id,
        {
          title: form.title.trim(),
          started_at: startedAt,
          estimated_end_at: estimatedEndAt,
          // Support engineers keep the old behaviour (inherit the case's
          // assignee); TH/TL get to pick who the sub task actually goes to,
          // including nobody at all.
          assignee_id: canAssign ? engineerIds[0] : parentCase.assignee_id,
          co_assignee_ids: canAssign && engineerIds.length > 1 ? engineerIds.slice(1) : undefined,
        },
        scope,
      )
    },
    onSuccess: (sub) => {
      qc.invalidateQueries({ queryKey: ['sub-cases', parentCase.id] })
      qc.invalidateQueries({ queryKey: ['cases'] })
      qc.invalidateQueries({ queryKey: ['case', parentCase.id] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast({ title: `Case update ${sub.reference_no} created`, variant: 'success' })
      onOpenChange(false)
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  const valid = form.title.trim().length >= 3

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Add Case Update
            <span className="text-muted-foreground font-normal text-sm ml-1">· under {parentCase.reference_no}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="sub-title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="sub-title"
              placeholder="Brief summary of the work item"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start time</Label>
              <DateTimePicker
                value={form.started_at}
                onChange={(v) => setForm((f) => ({ ...f, started_at: v }))}
                label="Pick start time"
              />
            </div>
            <div className="space-y-1.5">
              <Label>End time</Label>
              <DateTimePicker
                value={form.estimated_end_at}
                onChange={(v) => setForm((f) => ({ ...f, estimated_end_at: v }))}
                label="Pick end time"
              />
            </div>
          </div>

          {canAssign && (
            <div className="space-y-1.5">
              <Label>Assign Support Engineer(s) <span className="text-muted-foreground font-normal">(optional)</span></Label>

              {selectedEngineers.length > 0 && (
                <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2">
                  {selectedEngineers.map((eng) => (
                    <div key={eng.id} className="flex items-center gap-2">
                      <UserAvatar name={eng.name} avatarUrl={eng.avatar} userId={eng.id} size="sm" border={false} shadow={false} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{eng.name}</p>
                        <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[eng.role] ?? eng.role}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEngineerIds((ids) => ids.filter((id) => id !== eng.id))}
                        className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {availableEngineers.length > 0 && (
                <Select value="" onValueChange={(uid) => setEngineerIds((ids) => [...ids, uid])}>
                  <SelectTrigger className="h-9 text-sm">
                    <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder={selectedEngineers.length ? 'Add another engineer…' : 'Select engineer(s)…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEngineers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[11px] text-muted-foreground">Leave empty to create the case update unassigned.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid || createM.isPending} onClick={() => createM.mutate()}>
            {createM.isPending ? 'Creating…' : 'Create Case Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
