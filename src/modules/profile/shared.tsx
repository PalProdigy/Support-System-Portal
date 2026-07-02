'use client'

import type { ReactNode } from 'react'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Badge } from '@/components/ui/badge'
import { ROLE_LABELS } from '@/lib/rbac'
import { formatDateTime } from '@/lib/utils'
import { Mail, Calendar } from 'lucide-react'
import type { User } from '@/types'

// Shared header shown at the top of every role's profile. Role-specific chips
// (tier, certification, team, …) are passed in via `badges`.
export function ProfileHeader({ user, badges }: { user: User; badges?: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-6 flex items-start gap-5 flex-wrap">
      <UserAvatar name={user.name} size="lg" />
      <div className="flex-1 min-w-0 space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{user.email}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>Joined {formatDateTime(user.created_at)}</span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
          <Badge variant={user.is_active ? 'default' : 'destructive'}>
            {user.is_active ? 'Active' : 'Inactive'}
          </Badge>
          {badges}
        </div>
      </div>
    </div>
  )
}

// Compact stat tile used across role profiles.
export function KpiCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  )
}

// A titled card wrapper for grouped content (lists, key-value rows).
export function InfoCard({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  )
}

// Single key → value row inside an InfoCard.
export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  )
}