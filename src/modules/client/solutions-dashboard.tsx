



'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CreateCaseDialog } from './create-case-dialog'
import { Lightbulb, PlusCircle, CheckCircle, Info } from 'lucide-react'
import type { Solution, ClientSolution } from '@/types'

interface SolutionCard {
  cs: ClientSolution
  solution: Solution
}

export function SolutionsDashboard() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const [createFor, setCreateFor] = useState<Solution | null>(null)
  const [viewDetails, setViewDetails] = useState<Solution | null>(null)

  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
  })

  const clientId = clients?.[0]?.id

  const { data: clientSolutions, isLoading: loadingCS } = useQuery({
    queryKey: ['client-solutions', clientId],
    queryFn: () => dp.listClientSolutions(clientId),
    enabled: !!clientId,
  })

  const { data: allSolutions } = useQuery({
    queryKey: ['solutions'],
    queryFn: () => dp.listSolutions(),
  })

  const loading = loadingClients || loadingCS

  const cards: SolutionCard[] = (clientSolutions ?? []).flatMap((cs) => {
    const solution = (allSolutions ?? []).find((s) => s.id === cs.solution_id)
    if (!solution) return []
    return [{ cs, solution }]
  })

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(2)].map((_, i) => <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />)}
    </div>
  )

  if (cards.length === 0) return (
    <EmptyState
      icon={Lightbulb}
      title="No solutions yet"
      description="Your account manager will assign solutions to your account."
    />
  )

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ cs, solution }) => (
          <div key={cs.id} className="rounded-xl border bg-card p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <Badge variant="outline" className="text-xs shrink-0">
                <CheckCircle className="h-3 w-3 mr-1 text-emerald-500" />
                Active
              </Badge>
            </div>

            {/* Name + description */}
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground">{solution.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-3">{solution.description}</p>
            </div>

            {/* Category badge */}
            {solution.category && (
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{solution.category}</span>
              </div>
            )}

            <div className="mt-auto pt-1 flex flex-col gap-2">
              {solution.details && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => setViewDetails(solution)}>
                  <Info className="h-3.5 w-3.5" /> View Details
                </Button>
              )}
              <Button size="sm" className="w-full" onClick={() => setCreateFor(solution)}>
                <PlusCircle className="h-3.5 w-3.5" /> Create Case
              </Button>
            </div>
          </div>
        ))}
      </div>

      <CreateCaseDialog
        open={!!createFor}
        onOpenChange={(o) => !o && setCreateFor(null)}
        solution={createFor}
      />

      {/* Solution full-details dialog */}
      <Dialog open={!!viewDetails} onOpenChange={(o) => !o && setViewDetails(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              {viewDetails?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {viewDetails?.category && (
              <Badge variant="secondary">{viewDetails.category}</Badge>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed">{viewDetails?.description}</p>
            {viewDetails?.details && (
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Full Details</p>
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{viewDetails.details}</pre>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewDetails(null)}>Close</Button>
            <Button onClick={() => { setCreateFor(viewDetails); setViewDetails(null) }}>
              <PlusCircle className="h-3.5 w-3.5" /> Create Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
