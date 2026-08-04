'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/shared/user-avatar'
import { canCreateSubCase } from '@/lib/rbac'
import { formatDateTime } from '@/lib/utils'
import { GitBranch, Plus, ChevronDown, ChevronRight, User as UserIcon, Clock, CheckCircle2, Pin, Send, AlertTriangle, Paperclip } from 'lucide-react'
import { AddSubCaseDialog } from './add-sub-case-dialog'
import type { Case, CaseStatus, User } from '@/types'

// Status-driven accent for the left edge of each sub task card, mirroring the
// status badge palette so the colour carries the same meaning across the app.
const STATUS_EDGE_COLORS: Record<CaseStatus, string> = {
  new:             'border-l-slate-400',
  triaged:         'border-l-indigo-500',
  assigned:        'border-l-cyan-500',
  in_progress:     'border-l-blue-600',
  pending_client:  'border-l-amber-500',
  resolved:        'border-l-emerald-500',
  pending_closure: 'border-l-violet-500',
  closed:          'border-l-zinc-400',
  escalated:       'border-l-red-600',
}

export function SubCasesSection({ parentCase }: { parentCase: Case }) {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const [addOpen, setAddOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data: subCases, isLoading } = useQuery({
    queryKey: ['sub-cases', parentCase.id],
    queryFn: () => dp.listSubCases(parentCase.id, scope),
  })

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))

  const subs = subCases ?? []
  const canAdd = canCreateSubCase(session.role)

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const recentSubId = subs.length
    ? subs.reduce((latest, s) =>
        new Date(s.created_at).getTime() > new Date(latest.created_at).getTime() ? s : latest
      ).id
    : null

  return (
    <div className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          Case Updates {subs.length > 0 && <span className="text-muted-foreground font-normal">({subs.length})</span>}
        </h3>
        {canAdd && (
          <Button size="sm" variant="outline" className="h-8" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Case Update
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : subs.length === 0 ? (
        <EmptyState icon={GitBranch} title="No case updates" description={canAdd ? 'Break this case into smaller work items with "Add Case Update".' : 'This case has no case updates yet.'} />
      ) : (
        <div className="space-y-2">
          {subs.map((s) => {
            const engineerNames = [s.assignee_id, ...(s.co_assignee_ids ?? [])]
              .filter((id): id is string => Boolean(id))
              .map((id) => usersMap[id]?.name)
              .filter((name): name is string => Boolean(name))
            const isRecent = s.id === recentSubId
            const isOpen = expanded.has(s.id)
            const isRunning = s.timer_status === 'running'

            return (
              <div key={s.id} className={`rounded-lg border border-l-4 overflow-hidden transition-all ${
                isRunning
                  ? `${STATUS_EDGE_COLORS[s.status]} bg-card shadow-[0_0_12px_-3px] shadow-blue-400/40 dark:shadow-blue-600/50`
                  : `${STATUS_EDGE_COLORS[s.status]} bg-card hover:shadow-sm`
              } ${isRecent ? 'ring-1 ring-blue-500/40' : ''}`}>
                {/* Header — clickable to expand/collapse */}
                <button
                  onClick={() => toggleExpand(s.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-accent/30 transition-colors"
                >
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${
                    isRunning ? 'bg-blue-500' : 'bg-muted-foreground/20'
                  }`}>
                    {isRunning ? (
                      <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    ) : s.closed_at ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm truncate font-medium text-foreground">{s.title}</p>
                      {isRunning && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                          <Clock className="h-2.5 w-2.5 animate-pulse" /> Running
                        </span>
                      )}
                      {isRecent && !isRunning && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          <Pin className="h-2.5 w-2.5 fill-current" /> Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-3 w-3" /> {engineerNames.length > 0 ? engineerNames.join(', ') : 'Unassigned'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Created {formatDateTime(s.created_at)}
                      </span>
                      {s.closed_at && (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Closed
                        </span>
                      )}
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform" />
                  )}
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t border-border px-3 py-3 space-y-3 bg-muted/20">
                    {s.description?.trim() && (
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    )}

                    <div className="flex items-center gap-2">
                      {s.assignee_id && usersMap[s.assignee_id] && (
                        <div className="flex items-center gap-1.5">
                          <UserAvatar name={usersMap[s.assignee_id].name} size="sm" />
                          <span className="text-xs font-medium text-foreground">{usersMap[s.assignee_id].name}</span>
                        </div>
                      )}
                      {s.timer_status === 'running' && (
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 ml-auto">
                          <Clock className="h-3 w-3 animate-pulse" /> running
                        </span>
                      )}
                    </div>

                    {/* Inline comment box */}
                    <div className="flex items-end gap-1.5 bg-muted/40 dark:bg-muted/5 rounded-lg p-1.5 ring-1 ring-border focus-within:ring-2 focus-within:ring-primary/30 transition-all">
                      <input type="file" multiple className="hidden" id={`sub-attach-${s.id}`} />
                      <label
                        htmlFor={`sub-attach-${s.id}`}
                        className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                      </label>
                      <Textarea placeholder="Add a note..." rows={1} className="flex-1 min-h-0 border-0 bg-transparent resize-none px-1 py-1.5 text-xs shadow-none focus-visible:ring-0" />
                      <Button size="icon" className="shrink-0 h-7 w-7 rounded-md">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <button
                      onClick={() => router.push(`/cases/${s.id}`)}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      Open full view <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {canAdd && addOpen && <AddSubCaseDialog parentCase={parentCase} open={addOpen} onOpenChange={setAddOpen} />}
    </div>
  )
}
