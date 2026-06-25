'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { QueueTable } from './queue-table'
import { QueueKanban } from './queue-kanban'
import { toast } from '@/hooks/use-toast'
import { LayoutList, Columns3, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Case, User, Client } from '@/types'

export function TeamQueue() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [escalating, setEscalating] = useState<Case | null>(null)

  const { data: casesPage, isLoading: loadingCases } = useQuery({
    queryKey: ['cases', 'team', session.userId],
    queryFn: () => dp.listCases(scope, { pageSize: 200 }),
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => dp.listUsers(),
  })

  const { data: clients } = useQuery({
    queryKey: ['clients', scope],
    queryFn: () => dp.listClients(scope),
  })

  // Find this lead's team
  const myUser = (users ?? []).find((u) => u.id === session.userId)
  const teamId = myUser?.team_id

  const engineers: User[] = useMemo(() =>
    (users ?? []).filter((u) => u.role === 'support_engineer' && u.team_id === teamId),
    [users, teamId]
  )

  const usersMap: Record<string, User> = useMemo(() =>
    Object.fromEntries((users ?? []).map((u) => [u.id, u])),
    [users]
  )

  const clientsMap: Record<string, string> = useMemo(() =>
    Object.fromEntries((clients ?? []).map((c: Client) => [c.id, c.company_name])),
    [clients]
  )

  const cases = casesPage?.items ?? []

  const escalateMutation = useMutation({
    mutationFn: (c: Case) => dp.escalateCase(c.id, scope),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['cases'] })
      toast({ title: 'Case escalated', description: `${updated.reference_no} escalated to Technical Head`, variant: 'success' })
      setEscalating(null)
    },
    onError: () => toast({ title: 'Failed to escalate', variant: 'destructive' }),
  })

  if (loadingCases) return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
    </div>
  )

  return (
    <div className="space-y-3">
      {/* View toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{cases.length} cases in team queue</p>
        <div className="flex items-center rounded-lg border p-0.5 gap-0.5">
          <Button
            variant={view === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2.5"
            onClick={() => setView('table')}
          >
            <LayoutList className="h-3.5 w-3.5" />
            <span className="text-xs ml-1">Table</span>
          </Button>
          <Button
            variant={view === 'kanban' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2.5"
            onClick={() => setView('kanban')}
          >
            <Columns3 className="h-3.5 w-3.5" />
            <span className="text-xs ml-1">Board</span>
          </Button>
        </div>
      </div>

      {view === 'table' ? (
        <QueueTable
          cases={cases}
          engineers={engineers}
          usersMap={usersMap}
          clientsMap={clientsMap}
          onEscalate={setEscalating}
        />
      ) : (
        <QueueKanban
          cases={cases}
          engineers={engineers}
          usersMap={usersMap}
          clientsMap={clientsMap}
          onEscalate={setEscalating}
        />
      )}

      {/* Escalate confirmation dialog */}
      <Dialog open={!!escalating} onOpenChange={(o) => !o && setEscalating(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Escalate to Technical Head
            </DialogTitle>
          </DialogHeader>
          {escalating && (
            <div className="space-y-3 py-1">
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{escalating.reference_no}</span>
                <p className="font-medium mt-0.5 line-clamp-2">{escalating.title}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                This will mark the case as <span className="font-semibold text-foreground">Escalated</span> and notify the Technical Head immediately.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalating(null)}>Cancel</Button>
            <Button
              className={cn('bg-amber-600 hover:bg-amber-700 text-white')}
              onClick={() => escalating && escalateMutation.mutate(escalating)}
              disabled={escalateMutation.isPending}
            >
              {escalateMutation.isPending ? 'Escalating…' : 'Escalate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}