'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { canAccess } from '@/lib/rbac'
import { UserAvatar } from '@/components/shared/user-avatar'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { StatCard } from '@/components/shared/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SearchInput } from '@/components/ui/search-input'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'
import {
  Shield, ShieldCheck, SlidersHorizontal, X,
  PlusCircle, Pencil, Trash2, RefreshCw, UserPlus, ArrowUpCircle, LogIn, LogOut,
  Activity, Users, Clock,
} from 'lucide-react'
import type { AuditLog, User, AuditAction } from '@/types'

const ACTION_META: Record<AuditAction, { label: string; icon: typeof PlusCircle; className: string }> = {
  create: { label: 'Created', icon: PlusCircle, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  update: { label: 'Updated', icon: Pencil, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  delete: { label: 'Deleted', icon: Trash2, className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  status_change: { label: 'Status Change', icon: RefreshCw, className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' },
  assign: { label: 'Assigned', icon: UserPlus, className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400' },
  escalate: { label: 'Escalated', icon: ArrowUpCircle, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  login: { label: 'Login', icon: LogIn, className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  logout: { label: 'Logout', icon: LogOut, className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
}

/** Field names that actually changed between before/after — falls back to the
 *  full payload for create (no before) and delete (no after) entries. */
function changedFields(log: AuditLog): string[] {
  if (!log.before) return Object.keys(log.after ?? {})
  if (!log.after) return Object.keys(log.before ?? {})
  const keys = new Set([...Object.keys(log.before), ...Object.keys(log.after)])
  return [...keys].filter((k) => JSON.stringify(log.before?.[k]) !== JSON.stringify(log.after?.[k]))
}

function entityLabel(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function AuditLogPage() {
  const session = useSession()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  if (!canAccess(scope, 'view_audit_log', 'audit_log')) {
    router.replace('/dashboard')
    return null
  }

  return <AuditContent />
}

function AuditContent() {
  const dp = getDataProvider()

  const [query, setQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [actorFilter, setActorFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')

  const { data: logs, isLoading, error, refetch } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => dp.listAuditLogs({ limit: 300 }),
  })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const usersMap = useMemo(() => Object.fromEntries((users ?? []).map((u: User) => [u.id, u])), [users])

  const all = useMemo(() => logs ?? [], [logs])

  // Filter option lists — derived from the loaded logs, so every choice is
  // guaranteed to return at least one result.
  const entityOptions = useMemo(() => Array.from(new Set(all.map((l) => l.entity_type))).sort(), [all])
  const actorOptions = useMemo(() => {
    const ids = Array.from(new Set(all.map((l) => l.actor_id)))
    return ids
      .map((id) => ({ id, name: usersMap[id]?.name ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [all, usersMap])

  const hasActiveFilters = actionFilter !== 'all' || entityFilter !== 'all' || actorFilter !== 'all' || !!dateFilter
  const activeFilterCount = [actionFilter !== 'all', entityFilter !== 'all', actorFilter !== 'all', !!dateFilter].filter(Boolean).length

  const clearFilters = () => {
    setActionFilter('all')
    setEntityFilter('all')
    setActorFilter('all')
    setDateFilter('')
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((l: AuditLog) => {
      if (actionFilter !== 'all' && l.action !== actionFilter) return false
      if (entityFilter !== 'all' && l.entity_type !== entityFilter) return false
      if (actorFilter !== 'all' && l.actor_id !== actorFilter) return false
      if (dateFilter && new Date(l.created_at).toISOString().slice(0, 10) !== dateFilter) return false
      if (!q) return true
      const actor = usersMap[l.actor_id]
      return (
        actor?.name.toLowerCase().includes(q) ||
        l.entity_type.toLowerCase().includes(q) ||
        l.entity_id.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q)
      )
    })
  }, [all, query, actionFilter, entityFilter, actorFilter, dateFilter, usersMap])

  // Summary metrics for the KPI row.
  const todayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return all.filter((l) => l.created_at.slice(0, 10) === today).length
  }, [all])
  const uniqueActors = useMemo(() => new Set(all.map((l) => l.actor_id)).size, [all])
  const sensitiveCount = useMemo(() => all.filter((l) => l.action === 'delete' || l.action === 'escalate').length, [all])

  if (error) return <div className="p-6"><ErrorState onRetry={refetch} /></div>

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Audit Log</h1>

        </div>
      </div>

      {/* ── KPI row ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Total Events" value={all.length} icon={Activity} loading={isLoading} />
        <StatCard title="Today" value={todayCount} icon={Clock} iconColor="text-blue-500" loading={isLoading} />
        <StatCard title="Unique Actors" value={uniqueActors} icon={Users} iconColor="text-violet-500" loading={isLoading} />
        <StatCard
          title="Sensitive Actions"
          value={sensitiveCount}
          icon={ShieldCheck}
          iconColor={sensitiveCount > 0 ? 'text-red-500' : 'text-emerald-500'}
          subtitle=""
          loading={isLoading}
        />
      </div>

      {/* ── Toolbar: search + filters ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5 p-1 lg:p-0">
        <SearchInput
          value={query}
          onChange={setQuery}
          debounceMs={200}
          placeholder="Search by actor, entity type, entity ID or action…"
          containerClassName="min-w-0 flex-1 lg:min-w-[220px]"
          aria-label="Search audit log"
          resultCount={filtered.length}
          resultLabel="event"
        />

        {/* Mobile — compact "Filters" popover (unchanged) */}
        <div className="lg:hidden">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('shrink-0', hasActiveFilters && 'border-primary/50 text-primary')}>
                <SlidersHorizontal className="h-4 w-4" /> Filters
                {hasActiveFilters && (
                  <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 text-xs font-semibold">{activeFilterCount}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-72 max-h-[min(70vh,var(--radix-popover-content-available-height,70vh))] overflow-y-auto space-y-3 px-3 py-3"
              align="end"
              collisionPadding={8}
            >
              <div className="flex items-center justify-between p-2">
                <p className="text-sm font-semibold">Filter events</p>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={clearFilters}>
                    <X className="h-3 w-3" /> Clear
                  </Button>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Action</Label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All actions" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {(Object.keys(ACTION_META) as AuditAction[]).map((a) => (
                      <SelectItem key={a} value={a}>{ACTION_META[a].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Entity type</Label>
                <Select value={entityFilter} onValueChange={setEntityFilter}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All entities" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All entities</SelectItem>
                    {entityOptions.map((e) => <SelectItem key={e} value={e}>{entityLabel(e)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Actor</Label>
                <Select value={actorFilter} onValueChange={setActorFilter}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All actors" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actors</SelectItem>
                    {actorOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Date</Label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Desktop — individual filters laid out in one row, like the cases page */}
        <div className="hidden lg:flex lg:flex-wrap lg:items-center gap-2.5">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="All actions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {(Object.keys(ACTION_META) as AuditAction[]).map((a) => (
                <SelectItem key={a} value={a}>{ACTION_META[a].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="All entities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {entityOptions.map((e) => <SelectItem key={e} value={e}>{entityLabel(e)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={actorFilter} onValueChange={setActorFilter}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All actors" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actors</SelectItem>
              {actorOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="flex h-9 w-40 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {hasActiveFilters && (
            <Button variant="outline" className="h-9" onClick={clearFilters}>
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={query || hasActiveFilters ? 'No matching events' : 'No audit logs yet'}
          description={query || hasActiveFilters ? 'Try different keywords or clear the filters.' : 'Activity across the system will appear here.'}
        />
      ) : (
        <>
          {/* Table — scrolls horizontally on narrow screens instead of switching to cards,
              so every column stays visible and aligned at any viewport width. */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">At</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Actor</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Entity</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Changed fields</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log: AuditLog) => {
                    const actor = usersMap[log.actor_id]
                    const meta = ACTION_META[log.action] ?? { label: log.action, icon: Activity, className: 'bg-muted text-muted-foreground' }
                    const Icon = meta.icon
                    const fields = changedFields(log)
                    return (
                      <tr key={log.id} className="border-b last:border-0 hover:bg-accent/20 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap align-top">
                          <p className="text-xs font-medium text-foreground">{formatDateTime(log.created_at)}</p>
                          <p className="text-[11px] text-muted-foreground">{timeAgo(log.created_at)}</p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {actor ? (
                            <div className="flex items-center gap-2">
                              <UserAvatar name={actor.name} avatarUrl={actor.avatar} userId={actor.id} size="sm" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">{actor.name}</p>
                                <p className="text-[11px] text-muted-foreground capitalize truncate">{actor.role.replace('_', ' ')}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground font-mono">{log.actor_id}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap', meta.className)}>
                            <Icon className="h-3 w-3" /> {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px] shrink-0">{entityLabel(log.entity_type)}</Badge>
                            <span className="text-xs text-muted-foreground font-mono truncate">{log.entity_id.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {fields.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {fields.slice(0, 3).map((f) => (
                                <span key={f} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{f}</span>
                              ))}
                              {fields.length > 3 && <span className="text-[10px] text-muted-foreground">+{fields.length - 3} more</span>}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center pt-1">
            Showing {filtered.length} of {all.length} events
          </p>
        </>
      )}
    </div>
  )
}
