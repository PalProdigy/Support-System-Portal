'use client'

import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { UserAvatar } from '@/components/shared/user-avatar'
import { EmptyState } from '@/components/shared/empty-state'
import { formatDateTime } from '@/lib/utils'
import { canAccess } from '@/lib/rbac'
import { useRouter } from 'next/navigation'
import { Shield } from 'lucide-react'
import type { AuditLog, User } from '@/types'
import { Badge } from '@/components/ui/badge'

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  status_change: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
  assign: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400',
  escalate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  login: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  logout: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export default function AuditLogPage() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  if (!canAccess(scope, 'view_audit_log', 'audit_log')) {
    router.replace('/dashboard')
    return null
  }

  return <AuditContent />
}

function AuditContent() {
  const session = useSession()
  const dp = getDataProvider()

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => dp.listAuditLogs({ limit: 100 }),
  })

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const usersMap = Object.fromEntries((users ?? []).map((u: User) => [u.id, u]))

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">{logs?.length ?? 0} entries</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : (logs ?? []).length === 0 ? (
        <EmptyState icon={Shield} title="No audit logs" />
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">When</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(logs ?? []).map((log: AuditLog) => {
                const actor = usersMap[log.actor_id]
                return (
                  <tr key={log.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-2.5">
                      {actor ? (
                        <div className="flex items-center gap-1.5">
                          <UserAvatar name={actor.name} size="sm" />
                          <span className="text-xs font-medium">{actor.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{log.actor_id}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[log.action] ?? 'bg-muted text-muted-foreground'}`}>
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">{log.entity_type}</Badge>
                        <span className="text-xs text-muted-foreground font-mono">{log.entity_id.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {log.after ? Object.keys(log.after).join(', ') : '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}