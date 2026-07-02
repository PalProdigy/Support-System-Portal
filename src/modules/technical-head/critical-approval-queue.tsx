'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { toast } from '@/hooks/use-toast'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { ShieldCheck, ExternalLink, Star, CheckCircle2 } from 'lucide-react'
import type { Case, Feedback } from '@/types'

function StarRow({ rating }: { rating?: number }) {
  if (!rating) return null
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('h-3.5 w-3.5', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating}/5</span>
    </div>
  )
}

export function CriticalApprovalQueue() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }
  const router = useRouter()
  const [approvingCase, setApprovingCase] = useState<Case | null>(null)

  const { data: casesPage, isLoading } = useQuery({
    queryKey: ['cases', 'all-teams'],
    queryFn: () => dp.listCases(scope, { pageSize: 500 }),
    refetchInterval: 30_000,
  })

  const { data: feedback } = useQuery({
    queryKey: ['feedback', scope],
    queryFn: () => dp.listFeedback(scope),
  })

  const { data: clients } = useQuery({ queryKey: ['clients', scope], queryFn: () => dp.listClients(scope) })
  const { data: users }   = useQuery({ queryKey: ['users'],          queryFn: () => dp.listUsers() })

  const clientsMap  = useMemo(() => Object.fromEntries((clients  ?? []).map((c) => [c.id, c.company_name])), [clients])
  const usersMap    = useMemo(() => Object.fromEntries((users    ?? []).map((u) => [u.id, u.name])),    [users])
  const feedbackMap = useMemo(() => Object.fromEntries((feedback ?? []).map((f) => [f.case_id, f])),    [feedback])

  // Pending TH approval: critical + resolved (or pending_closure) + !th_approved
  const pendingApproval = useMemo(() =>
    (casesPage?.items ?? []).filter(
      (c) => c.priority === 'critical' && ['resolved', 'pending_closure'].includes(c.status) && !c.th_approved
    ),
    [casesPage]
  )

  // Already approved + recently closed critical cases
  const approvedRecent = useMemo(() =>
    (casesPage?.items ?? []).filter(
      (c) => c.priority === 'critical' && c.th_approved
    ).slice(0, 8),
    [casesPage]
  )

  const approveMutation = useMutation({
    mutationFn: (c: Case) => dp.approveCriticalResolution(c.id, scope),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['cases'] })
      toast({ title: `Case ${updated.reference_no} approved — Team Lead can now close it`, variant: 'success' })
      setApprovingCase(null)
    },
    onError: () => toast({ title: 'Approval failed', variant: 'destructive' }),
  })

  if (isLoading) return (
    <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}</div>
  )

  return (
    <div className="space-y-6">
      {/* Pending approval */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-red-600 dark:text-red-400" />
          <h3 className="text-sm font-semibold text-foreground">Awaiting Your Approval</h3>
          {pendingApproval.length > 0 && (
            <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full font-semibold">
              {pendingApproval.length}
            </span>
          )}
        </div>

        {pendingApproval.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No critical cases pending approval"
            description="When an engineer resolves a critical-priority case, it will appear here for your approval before the Team Lead can close it."
          />
        ) : (
          <div className="space-y-3">
            {pendingApproval.map((c) => {
              const fb = feedbackMap[c.id]
              return (
                <div key={c.id} className="rounded-xl border border-red-200 dark:border-red-800 bg-card p-4 space-y-3">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <span className="font-mono text-xs text-muted-foreground">{c.reference_no}</span>
                      <p className="font-semibold text-sm text-foreground">{c.title}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>{clientsMap[c.client_id] ?? '—'}</span>
                        {c.assignee_id && <span>Resolved by {usersMap[c.assignee_id] ?? '—'}</span>}
                        <span>Resolved {formatDate(c.resolved_at ?? c.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => router.push(`/cases/${c.id}`)}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setApprovingCase(c)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Approve Resolution
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground bg-red-50/40 dark:bg-red-950/20 rounded-lg px-3 py-2 border border-red-100 dark:border-red-900/40">
                    Critical case — your approval is required before the Team Lead can close this case.
                  </p>
                  {fb && (
                    <div className="rounded-lg bg-muted/40 border p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">Client Feedback</span>
                        <StarRow rating={fb.rating} />
                      </div>
                      <p className="text-xs text-muted-foreground">{fb.feedback_text}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recently approved */}
      {approvedRecent.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Recently Approved
          </h3>
          {approvedRecent.map((c) => (
            <div key={c.id} className="rounded-xl border bg-card/60 p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{c.reference_no}</span>
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-full">TH Approved</span>
                </div>
                <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                <p className="text-xs text-muted-foreground">{clientsMap[c.client_id] ?? '—'} · Resolved {formatDate(c.resolved_at ?? c.created_at)}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => router.push(`/cases/${c.id}`)}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Approve confirmation dialog */}
      <Dialog open={!!approvingCase} onOpenChange={(o) => !o && setApprovingCase(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <ShieldCheck className="h-4 w-4" /> Approve Critical Resolution
            </DialogTitle>
          </DialogHeader>
          {approvingCase && (
            <div className="space-y-3 py-1">
              <div className="rounded-lg bg-muted/40 px-3 py-2">
                <span className="font-mono text-xs text-muted-foreground">{approvingCase.reference_no}</span>
                <p className="font-medium text-sm mt-0.5">{approvingCase.title}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                This approves the engineer's resolution of this critical case. The Team Lead will be notified and can proceed to close it.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovingCase(null)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => approvingCase && approveMutation.mutate(approvingCase)}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Approving…' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
