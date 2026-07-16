'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { canCreateSubCase } from '@/lib/rbac'
import { formatDateTime } from '@/lib/utils'
import { GitBranch, Plus, ChevronRight, User as UserIcon, Clock, CheckCircle2, Pin } from 'lucide-react'
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

  const { data: subCases, isLoading } = useQuery({
    queryKey: ['sub-cases', parentCase.id],
    queryFn: () => dp.listSubCases(parentCase.id, scope),
  })

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))

  const subs = subCases ?? []
  const canAdd = canCreateSubCase(session.role)

  // The "current" sub task is the most recently created one — pinned below so
  // it's easy to spot which branch is the latest addition to the case.
  const recentSubId = subs.length
    ? subs.reduce((latest, s) =>
        new Date(s.created_at).getTime() > new Date(latest.created_at).getTime() ? s : latest
      ).id
    : null

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          Sub Tasks {subs.length > 0 && <span className="text-muted-foreground font-normal">({subs.length})</span>}
        </h3>
        {canAdd && (
          <Button size="sm" variant="outline" className="h-8" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Sub Task
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : subs.length === 0 ? (
        <EmptyState icon={GitBranch} title="No sub tasks" description={canAdd ? 'Break this case into smaller work items with “Add Sub Task”.' : 'This case has no sub tasks yet.'} />
      ) : (
        <div className="pt-1">
          {/* Root node — the main case */}
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <GitBranch className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{parentCase.title}</p>
              <p className="text-[10px] font-mono text-muted-foreground">Main Case · {parentCase.reference_no}</p>
            </div>
          </div>

          {/* Branches — each sub task */}
          <ul className="ml-3 mt-1 border-l border-border">
            {subs.map((s) => {
              const engineerNames = [s.assignee_id, ...(s.co_assignee_ids ?? [])]
                .filter((id): id is string => Boolean(id))
                .map((id) => usersMap[id]?.name)
                .filter((name): name is string => Boolean(name))
              const isRecent = s.id === recentSubId
              return (
                <li key={s.id} className="relative pl-5 pt-3">
                  {/* Horizontal connector */}
                  <span className="absolute left-0 top-6 h-px w-4 bg-border" />
                  {/* Tree node — a blue pin marks the current (most recent) sub task */}
                  {isRecent ? (
                    <span
                      title="Current sub task"
                      className="absolute left-0 top-6 z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-blue-600 text-white ring-2 ring-background"
                    >
                      <Pin className="h-2.5 w-2.5 fill-current" />
                    </span>
                  ) : (
                    <span className="absolute left-0 top-6 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border ring-2 ring-background" />
                  )}
                  <div
                    onClick={() => router.push(`/cases/${s.id}`)}
                    className={`group flex items-start gap-3 rounded-lg border border-l-4 ${STATUS_EDGE_COLORS[s.status]} bg-background p-3 cursor-pointer hover:bg-accent/30 transition-colors ${
                      isRecent ? 'ring-1 ring-blue-500/40' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                        {isRecent && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            <Pin className="h-2.5 w-2.5 fill-current" /> Current
                          </span>
                        )}
                      </div>
                      {s.description?.trim() && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                      )}
                      <div className="flex items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground flex-wrap pt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <UserIcon className="h-3 w-3" /> {engineerNames.length > 0 ? engineerNames.join(', ') : 'Unassigned'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Created {formatDateTime(s.created_at)}
                        </span>
                        {s.closed_at && (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Closed {formatDateTime(s.closed_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {canAdd && addOpen && <AddSubCaseDialog parentCase={parentCase} open={addOpen} onOpenChange={setAddOpen} />}
    </div>
  )
}
