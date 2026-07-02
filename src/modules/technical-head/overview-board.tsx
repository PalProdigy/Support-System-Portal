'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import {
  cn, formatDate, formatDuration, slaRemainingMs,
  PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS,
} from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { ExternalLink, Search, AlertTriangle, Clock, Users } from 'lucide-react'
import type { Case, Team, Client, User } from '@/types'
import type { CaseStatus, Priority } from '@/types'

const ALL = 'all'

export function OverviewBoard() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState(ALL)
  const [filterPriority, setFilterPriority] = useState(ALL)
  const [filterTeam, setFilterTeam] = useState(ALL)

  const { data: casesPage, isLoading } = useQuery({
    queryKey: ['cases', 'all-teams'],
    queryFn: () => dp.listCases(scope, { pageSize: 500 }),
    refetchInterval: 60_000,
  })

  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
  const { data: clients } = useQuery({ queryKey: ['clients', scope], queryFn: () => dp.listClients(scope) })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })

  const teamsMap  = useMemo(() => Object.fromEntries((teams  ?? []).map((t) => [t.id, t.name])),    [teams])
  const clientsMap = useMemo(() => Object.fromEntries((clients ?? []).map((c) => [c.id, c.company_name])), [clients])
  const usersMap  = useMemo(() => Object.fromEntries((users  ?? []).map((u: User) => [u.id, u.name])), [users])

  // A case can have a primary assignee plus co-assignees — resolve them all to names.
  const engineersOf = (c: Case): string[] =>
    [c.assignee_id, ...(c.co_assignee_ids ?? [])]
      .filter((id): id is string => Boolean(id))
      .map((id) => usersMap[id] ?? id)

  const allCases = casesPage?.items ?? []

  const filtered = useMemo(() => {
    let out = allCases
    if (search)           out = out.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()) || c.reference_no.toLowerCase().includes(search.toLowerCase()))
    if (filterStatus   !== ALL) out = out.filter((c) => c.status   === filterStatus)
    if (filterPriority !== ALL) out = out.filter((c) => c.priority === filterPriority)
    if (filterTeam     !== ALL) out = out.filter((c) => c.team_id  === filterTeam)
    return out
  }, [allCases, search, filterStatus, filterPriority, filterTeam])

  // Summary stats
  const openCount     = allCases.filter((c) => !['closed'].includes(c.status)).length
  const escalated     = allCases.filter((c) => c.is_escalated).length
  const breached      = allCases.filter((c) => !['closed', 'resolved', 'pending_closure'].includes(c.status) && slaRemainingMs(c.sla_due_at) < 0).length
  const criticalOpen  = allCases.filter((c) => c.priority === 'critical' && !['closed'].includes(c.status)).length

  const STATUSES: CaseStatus[] = ['new', 'triaged', 'assigned', 'in_progress', 'pending_client', 'escalated', 'resolved', 'pending_closure', 'closed']
  const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low']

  if (isLoading) return (
    <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
  )

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Open Cases',    value: openCount,    color: 'text-foreground' },
          { label: 'Escalated',     value: escalated,    color: 'text-red-600 dark:text-red-400' },
          { label: 'SLA Breached',  value: breached,     color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Critical Open', value: criticalOpen, color: 'text-red-700 dark:text-red-300' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border bg-card p-3 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className={cn('text-3xl font-bold tabular-nums', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search cases…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-8 rounded-md border bg-background text-sm px-2 text-foreground">
          <option value={ALL}>All Status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="h-8 rounded-md border bg-background text-sm px-2 text-foreground">
          <option value={ALL}>All Priority</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </select>
        <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} className="h-8 rounded-md border bg-background text-sm px-2 text-foreground">
          <option value={ALL}>All Teams</option>
          {(teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {allCases.length}</span>
      </div>

      {/* Case table */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              {['Ref', 'Title', 'Priority', 'Status', 'Assigned Engineer', 'Client', 'SLA', ''].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">No cases match the current filters</td></tr>
            )}
            {filtered.map((c) => {
              const rem         = slaRemainingMs(c.sla_due_at)
              const breachedSLA = rem < 0
              const isOpen      = !['closed', 'resolved', 'pending_closure'].includes(c.status)
              return (
                <tr key={c.id} className="border-b last:border-0 hover:bg-accent/20 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{c.reference_no}</td>
                  <td className="px-3 py-2.5 max-w-[200px]">
                    <div className="flex items-center gap-1.5">
                      {c.is_escalated && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                      <span className="truncate font-medium">{c.title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', PRIORITY_COLORS[c.priority])}>
                      {PRIORITY_LABELS[c.priority]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[c.status])}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 max-w-[200px]">
                    {(() => {
                      const engineers = engineersOf(c)
                      if (engineers.length === 0) return <span className="text-xs text-muted-foreground italic">Unassigned</span>
                      return (
                        <div className="flex items-center gap-1.5" title={engineers.join(', ')}>
                          <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate text-xs text-foreground">{engineers[0]}</span>
                          {engineers.length > 1 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                              +{engineers.length - 1}
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{clientsMap[c.client_id] ?? '—'}</td>
                  <td className={cn('px-3 py-2.5 whitespace-nowrap text-xs font-medium', isOpen ? (breachedSLA ? 'text-red-600 dark:text-red-400' : rem < 4 * 3600_000 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground') : 'text-muted-foreground')}>
                    {isOpen ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {breachedSLA ? `−${formatDuration(Math.abs(rem))}` : formatDuration(rem)}
                      </span>
                    ) : formatDate(c.closed_at ?? c.resolved_at ?? c.created_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => router.push(`/cases/${c.id}`)} className="text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}