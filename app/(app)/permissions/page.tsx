'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { canAccess, PERMISSIONS, PERMISSION_CAPABILITIES, ROLE_LABELS, type Resource, type Action } from '@/lib/rbac'
import { UserAvatar } from '@/components/shared/user-avatar'
import { EmptyState } from '@/components/shared/empty-state'
import { StatCard } from '@/components/shared/stat-card'
import { SearchInput } from '@/components/ui/search-input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { KeyRound, ShieldCheck, ShieldOff, Users, RotateCcw, Sparkles } from 'lucide-react'
import type { User, PermissionOverride } from '@/types'

export default function PermissionsPage() {
  const session = useSession()
  const router = useRouter()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: users, isLoading: usersLoading } = useQuery({ queryKey: ['users'], queryFn: () => dp.listUsers() })
  const { data: overrides, isLoading: overridesLoading } = useQuery({
    queryKey: ['permission-overrides'],
    queryFn: () => dp.listPermissionOverrides(),
  })

  const setMutation = useMutation({
    mutationFn: (input: { user_id: string; resource: Resource; action: Action; effect: 'allow' | 'deny' }) =>
      dp.setPermissionOverride({ ...input, granted_by: session.userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permission-overrides'] })
      toast({ title: 'Permission updated', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to update permission', variant: 'destructive' }),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => dp.removePermissionOverride(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['permission-overrides'] }),
    onError: () => toast({ title: 'Failed to reset permission', variant: 'destructive' }),
  })

  const clearAllMutation = useMutation({
    mutationFn: async (userOverrides: PermissionOverride[]) => {
      await Promise.all(userOverrides.map((o) => dp.removePermissionOverride(o.id)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permission-overrides'] })
      toast({ title: 'All overrides cleared', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to clear overrides', variant: 'destructive' }),
  })

  const overrideCountByUser = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of overrides ?? []) map.set(o.user_id, (map.get(o.user_id) ?? 0) + 1)
    return map
  }, [overrides])

  const q = search.trim().toLowerCase()
  const filteredUsers = (users ?? [])
    .filter((u) => u.role !== 'client')
    .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))

  const selectedUser = (users ?? []).find((u) => u.id === selectedId) ?? null
  const selectedOverrides = (overrides ?? []).filter((o) => o.user_id === selectedId)
  const selectedOverridesMap = new Map(selectedOverrides.map((o) => [`${o.resource}:${o.action}`, o]))

  if (!canAccess(scope, 'manage_permissions', 'system_settings')) {
    router.replace('/dashboard')
    return null
  }

  const totalOverrides = overrides?.length ?? 0
  const usersWithOverrides = overrideCountByUser.size

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Hero header */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 flex items-center gap-4">
        <div className="rounded-xl bg-primary/15 p-3 shrink-0">
          <KeyRound className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Permission Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Grant or revoke individual resource permissions on top of role defaults</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard title="Members" value={filteredUsers.length} icon={Users} loading={usersLoading} />
        <StatCard title="Members With Overrides" value={usersWithOverrides} icon={Sparkles} iconColor="text-violet-500" loading={overridesLoading} />
        <StatCard title="Active Overrides" value={totalOverrides} icon={ShieldCheck} iconColor="text-emerald-500" loading={overridesLoading} />
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
        {/* Member list */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="p-3 border-b">
            <SearchInput
              className="h-9"
              placeholder="Search members…"
              value={search}
              onChange={setSearch}
              debounceMs={200}
              aria-label="Search members"
            />
          </div>
          {usersLoading ? (
            <div className="p-3 space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : filteredUsers.length === 0 ? (
            <EmptyState size="sm" icon={Users} title="No members found" />
          ) : (
            <div className="max-h-[70vh] overflow-y-auto divide-y">
              {filteredUsers.map((u: User) => {
                const count = overrideCountByUser.get(u.id) ?? 0
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedId(u.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/50',
                      selectedId === u.id && 'bg-primary/10 hover:bg-primary/10'
                    )}
                  >
                    <UserAvatar name={u.name} avatarUrl={u.avatar} userId={u.id} size="sm" border={false} shadow={false} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{ROLE_LABELS[u.role]}</p>
                    </div>
                    {count > 0 && (
                      <span className="shrink-0 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-400 text-[10px] font-semibold px-1.5 py-0.5">
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Permission grid */}
        <div className="min-w-0">
          {!selectedUser ? (
            <div className="rounded-xl border bg-card">
              <EmptyState icon={KeyRound} title="Select a member" description="Pick someone from the list to view and edit their permissions." />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <UserAvatar name={selectedUser.name} avatarUrl={selectedUser.avatar} userId={selectedUser.id} size="md" />
                  <div>
                    <p className="text-base font-semibold text-foreground">{selectedUser.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedUser.email} · Role default: {ROLE_LABELS[selectedUser.role]}</p>
                  </div>
                </div>
                {selectedOverrides.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={clearAllMutation.isPending}
                    onClick={() => clearAllMutation.mutate(selectedOverrides)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset all to role defaults
                  </Button>
                )}
              </div>

              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
                  <h3 className="text-sm font-semibold text-foreground">Permissions</h3>
                </div>
                <div className="divide-y">
                  {PERMISSION_CAPABILITIES.map(({ key, label, resource, action }) => {
                    const roleDefault = (PERMISSIONS[selectedUser.role]?.[resource] ?? []).includes(action)
                    const override = selectedOverridesMap.get(`${resource}:${action}`)
                    const effective = override ? override.effect === 'allow' : roleDefault
                    const isOverridden = !!override

                    return (
                      <div key={key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm text-foreground truncate">{label}</span>
                          {isOverridden && (
                            <span className={cn(
                              'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0',
                              effective ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-red-500/10 text-red-600 dark:text-red-400',
                            )}>
                              {effective ? <ShieldCheck className="h-2.5 w-2.5" /> : <ShieldOff className="h-2.5 w-2.5" />}
                              Custom
                            </span>
                          )}
                          {!isOverridden && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {roleDefault ? 'default: allowed' : 'default: denied'}
                            </span>
                          )}
                        </div>
                        <Switch
                          checked={effective}
                          disabled={setMutation.isPending || removeMutation.isPending}
                          onCheckedChange={(checked) => {
                            if (checked === roleDefault) {
                              if (override) removeMutation.mutate(override.id)
                            } else {
                              setMutation.mutate({ user_id: selectedUser.id, resource, action, effect: checked ? 'allow' : 'deny' })
                            }
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
