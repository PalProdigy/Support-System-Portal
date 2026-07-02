'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { toast } from '@/hooks/use-toast'
import { cn, formatDate, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/utils'
import { CheckCircle2, Star, ExternalLink, RotateCcw, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Case, Feedback } from '@/types'

function StarRow({ rating }: { rating?: number }) {
  if (!rating) return <span className="text-xs text-muted-foreground italic">No rating</span>
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('h-3.5 w-3.5', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating}/5</span>
    </div>
  )
}

interface RowData { caseData: Case; feedback: Feedback | undefined; client: string }

export function ClosureQueue() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }
  const router = useRouter()

  const [closingCase, setClosingCase] = useState<Case | null>(null)
  const [reopeningCase, setReopeningCase] = useState<Case | null>(null)

  const { data: casesPage, isLoading } = useQuery({
    queryKey: ['cases', 'team', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 200 }),
  })

  const { data: feedback } = useQuery({
    queryKey: ['feedback', 'team'],
    queryFn: () => dp.listFeedback(scope),
  })

  const { data: clients } = useQuery({
    queryKey: ['clients', scope],
    queryFn: () => dp.listClients(scope),
  })

  const feedbackMap = useMemo(() =>
    Object.fromEntries((feedback ?? []).map((f) => [f.case_id, f])),
    [feedback]
  )

  const clientsMap = useMemo(() =>
    Object.fromEntries((clients ?? []).map((c) => [c.id, c.company_name])),
    [clients]
  )

  const pendingClosure: RowData[] = useMemo(() =>
    (casesPage?.items ?? [])
      .filter((c) => c.status === 'pending_closure')
      .map((c) => ({ caseData: c, feedback: feedbackMap[c.id], client: clientsMap[c.client_id] ?? '—' })),
    [casesPage, feedbackMap, clientsMap]
  )

  const recentClosed: RowData[] = useMemo(() =>
    (casesPage?.items ?? [])
      .filter((c) => c.status === 'closed')
      .slice(0, 10)
      .map((c) => ({ caseData: c, feedback: feedbackMap[c.id], client: clientsMap[c.client_id] ?? '—' })),
    [casesPage, feedbackMap, clientsMap]
  )

  const grantMutation = useMutation({
    mutationFn: (c: Case) => dp.grantClosure(c.id, scope),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['cases'] })
      toast({ title: 'Case closed', description: `${updated.reference_no} closed — client and engineer notified`, variant: 'success' })
      setClosingCase(null)
    },
    onError: () => toast({ title: 'Failed to close case', variant: 'destructive' }),
  })

  const reopenMutation = useMutation({
    mutationFn: (c: Case) => dp.reopenCase(c.id, scope),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['cases'] })
      toast({ title: 'Case reopened', description: `${updated.reference_no} moved back to In Progress`, variant: 'success' })
      setReopeningCase(null)
    },
    onError: () => toast({ title: 'Failed to reopen', variant: 'destructive' }),
  })

  if (isLoading) return (
    <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}</div>
  )

  return (
    <div className="space-y-6">
      {/* Pending closure */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Pending Your Closure Review</h3>
          {pendingClosure.length > 0 && (
            <span className="text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full font-semibold">{pendingClosure.length}</span>
          )}
        </div>

        {pendingClosure.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No cases pending closure" description="Cases waiting for your review will appear here after the client submits feedback." />
        ) : (
          <div className="space-y-3">
            {pendingClosure.map(({ caseData: c, feedback: fb, client }) => (
              <div key={c.id} className="rounded-xl border bg-card p-4 space-y-3 border-violet-200 dark:border-violet-800">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{c.reference_no}</span>
                      <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', PRIORITY_COLORS[c.priority])}>{PRIORITY_LABELS[c.priority]}</span>
                    </div>
                    <p className="font-semibold text-sm text-foreground line-clamp-1">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{client} · Resolved {formatDate(c.resolved_at ?? c.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push(`/cases/${c.id}`)}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    {c.priority === 'critical' && !c.th_approved ? (
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-md px-2.5 py-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                        Awaiting TH approval
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => setClosingCase(c)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Grant Closure
                      </Button>
                    )}
                  </div>
                </div>

                {fb ? (
                  <div className="rounded-lg bg-muted/40 border p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">Client Feedback</p>
                      <StarRow rating={fb.rating} />
                    </div>
                    <p className="text-sm text-muted-foreground">{fb.feedback_text}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No feedback submitted yet</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recently closed */}
      {recentClosed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Recently Closed</h3>
          <div className="space-y-2">
            {recentClosed.map(({ caseData: c, feedback: fb, client }) => (
              <div key={c.id} className="rounded-xl border bg-card/60 p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{c.reference_no}</span>
                    {fb?.rating && <StarRow rating={fb.rating} />}
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground">{client} · Closed {formatDate(c.closed_at ?? c.created_at)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push(`/cases/${c.id}`)}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Reopen" onClick={() => setReopeningCase(c)}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grant closure dialog */}
      <Dialog open={!!closingCase} onOpenChange={(o) => !o && setClosingCase(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Grant Final Closure
            </DialogTitle>
          </DialogHeader>
          {closingCase && (
            <div className="space-y-3 py-1">
              <div className="rounded-lg bg-muted/40 px-3 py-2">
                <span className="font-mono text-xs text-muted-foreground">{closingCase.reference_no}</span>
                <p className="font-medium text-sm mt-0.5 line-clamp-2">{closingCase.title}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                This will mark the case as <strong className="text-foreground">Closed</strong> and notify the client and the assigned engineer.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosingCase(null)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => closingCase && grantMutation.mutate(closingCase)} disabled={grantMutation.isPending}>
              {grantMutation.isPending ? 'Closing…' : 'Close Case'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen dialog */}
      <Dialog open={!!reopeningCase} onOpenChange={(o) => !o && setReopeningCase(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" /> Reopen Case
            </DialogTitle>
          </DialogHeader>
          {reopeningCase && (
            <div className="space-y-3 py-1">
              <div className="rounded-lg bg-muted/40 px-3 py-2">
                <span className="font-mono text-xs text-muted-foreground">{reopeningCase.reference_no}</span>
                <p className="font-medium text-sm mt-0.5 line-clamp-2">{reopeningCase.title}</p>
              </div>
              <p className="text-sm text-muted-foreground">Case will move back to <strong className="text-foreground">In Progress</strong>. The engineer and Team Lead will be notified.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopeningCase(null)}>Cancel</Button>
            <Button onClick={() => reopeningCase && reopenMutation.mutate(reopeningCase)} disabled={reopenMutation.isPending}>
              {reopenMutation.isPending ? 'Reopening…' : 'Reopen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
