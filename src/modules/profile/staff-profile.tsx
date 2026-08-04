'use client'

import { useState, type ReactNode } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InfoCard, StatTile } from './shared'
import { EditProfileDialog } from './edit-profile-dialog'
import { useSession } from '@/lib/auth/context'
import { ROLE_LABELS } from '@/lib/rbac'
import { getInitials, formatDate } from '@/lib/utils'
import {
  Pencil, Mail, Calendar, IdCard, Building2, Briefcase, Award,
  Phone, Languages, Wrench, Sparkles, FileText, Download, TrendingUp, Trophy,
  Star, Zap, ShieldCheck, Medal,
} from 'lucide-react'
import type { User, AchievementType, CertificationLevel } from '@/types'

// Colour tiers for the certification level badge (L1 junior → L5 expert).
const CERT_LEVEL_COLORS: Record<CertificationLevel, string> = {
  L1: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-600',
  L2: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-700',
  L3: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/40 dark:text-violet-400 dark:border-violet-700',
  L4: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700',
  L5: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-700',
}

const CERT_LEVELS: CertificationLevel[] = ['L1', 'L2', 'L3', 'L4', 'L5']

// Deterministic placeholder certification (stable per user) so the badge
// always has something to show before a real level has been assigned.
function demoCertificationLevel(seed: string): CertificationLevel {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return CERT_LEVELS[Math.abs(hash) % CERT_LEVELS.length]
}

export interface StatItem {
  icon: ReactNode
  label: string
  value: string
}

// Human-readable tenure from a join date until now, e.g. "2 yr 6 mo".
function tenureSince(iso: string): string {
  const months = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (30.44 * 24 * 3600 * 1000)))
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m} mo`
  return m === 0 ? `${y} yr` : `${y} yr ${m} mo`
}

const ACHIEVEMENT_ICON: Record<AchievementType, { icon: typeof Trophy; color: string }> = {
  employee_of_month: { icon: Trophy, color: 'text-amber-500' },
  best_sla:          { icon: ShieldCheck, color: 'text-emerald-500' },
  fastest_resolution:{ icon: Zap, color: 'text-blue-500' },
  top_rating:        { icon: Star, color: 'text-yellow-500' },
  internal_award:    { icon: Medal, color: 'text-violet-500' },
}

function Chips({ items, empty }: { items?: string[]; empty: string }) {
  if (!items || items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
    </div>
  )
}

// Generic, editable staff profile shared by every non-client role. Role-specific
// data is limited to the `stats` summary — everything else lives on the User.
export function StaffProfile({ user, teamName, stats, summaryTitle = 'Performance Summary', points }: {
  user: User
  teamName?: string
  stats: StatItem[]
  summaryTitle?: string
  points?: number
}) {
  const session = useSession()
  const [editOpen, setEditOpen] = useState(false)
  const canEdit = session.userId === user.id

  const designation = user.designation ?? ROLE_LABELS[user.role]
  const department = user.department === 'sales' ? 'Sales'
    : user.department === 'technical' ? 'Technical'
    : user.role === 'sales_executive' ? 'Sales' : 'Technical'
  const employeeId = user.employee_id ?? user.id.toUpperCase()
  const certLevel = user.certification_level ?? demoCertificationLevel(user.id)

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-primary/20 via-primary/5 to-transparent" />
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between gap-4 flex-wrap -mt-10">
            <div className="flex items-end gap-4">
              <Avatar className="h-24 w-24 ring-4 ring-card shadow-sm">
                {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="pb-1 space-y-1">
                <h1 className="text-2xl font-bold text-foreground leading-tight">{user.name}</h1>
                <p className="text-sm text-muted-foreground">{designation}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
                  <Badge variant="outline" className={`font-mono gap-1 ${CERT_LEVEL_COLORS[certLevel]}`}>
                    <Award className="h-3 w-3" /> {certLevel}
                  </Badge>
                  {typeof points === 'number' && (
                    <Badge
                      variant="outline"
                      className="font-mono gap-1 bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700"
                    >
                      <Trophy className="h-3 w-3" /> {points} pts
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit Profile
              </Button>
            )}
          </div>

          {/* Meta strip */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Meta icon={<IdCard className="h-3.5 w-3.5" />} label="Employee ID" value={employeeId} />
            <Meta icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={user.email} />
            <Meta icon={<Building2 className="h-3.5 w-3.5" />} label="Department" value={department} />
            <Meta icon={<Calendar className="h-3.5 w-3.5" />} label="Joined" value={formatDate(user.created_at)} />
            <Meta icon={<Briefcase className="h-3.5 w-3.5" />} label="Experience" value={tenureSince(user.created_at)} />
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          <InfoCard title="About" icon={<Sparkles className="h-3.5 w-3.5" />}>
            {user.about
              ? <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{user.about}</p>
              : <p className="text-sm text-muted-foreground">No description added yet.</p>}
          </InfoCard>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InfoCard title="Technical Skills" icon={<Wrench className="h-3.5 w-3.5" />}>
              <Chips items={user.technical_skills} empty="No skills added yet." />
            </InfoCard>
            <InfoCard title="Expertise" icon={<Sparkles className="h-3.5 w-3.5" />}>
              <Chips items={user.expertise} empty="No expertise added yet." />
            </InfoCard>
          </div>

          <InfoCard title="Certifications" icon={<Award className="h-3.5 w-3.5" />}>
            {user.certifications && user.certifications.length > 0 ? (
              <div className="space-y-2.5">
                {user.certifications.map((c) => (
                  <div key={c.id} className="rounded-lg border p-3 flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
                      <Award className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{c.title}</p>
                      {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                      {c.file_name && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" /> {c.file_name}
                        </div>
                      )}
                    </div>
                    {c.file_url && (
                      <a href={c.file_url} download={c.file_name} className="text-muted-foreground hover:text-primary p-1 shrink-0" title="Download">
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No certifications added yet.</p>}
          </InfoCard>

          <InfoCard title="Achievements" icon={<Trophy className="h-3.5 w-3.5" />}>
            {user.achievements && user.achievements.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {user.achievements.map((a) => {
                  const { icon: Icon, color } = ACHIEVEMENT_ICON[a.type]
                  return (
                    <div key={a.id} className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
                      <Icon className={`h-5 w-5 shrink-0 ${color}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground leading-tight">{a.title}</p>
                        {a.description && <p className="text-[11px] text-muted-foreground mt-0.5">{a.description}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <p className="text-sm text-muted-foreground">No achievements recorded yet.</p>}
          </InfoCard>
        </div>

        {/* Side column */}
        <div className="space-y-5">
          {/*<InfoCard title={summaryTitle} icon={<TrendingUp className="h-3.5 w-3.5" />}>*/}
          {/*  <div className="grid grid-cols-2 gap-2.5">*/}
          {/*    {stats.map((s) => <StatTile key={s.label} icon={s.icon} label={s.label} value={s.value} />)}*/}
          {/*  </div>*/}
          {/*</InfoCard>*/}

          <InfoCard title="Contact" icon={<Phone className="h-3.5 w-3.5" />}>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              {(user.contact_numbers ?? []).map((num, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{num}</span>
                </div>
              ))}
              {teamName && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{teamName}</span>
                </div>
              )}
            </div>
          </InfoCard>

          <InfoCard title="Languages" icon={<Languages className="h-3.5 w-3.5" />}>
            <Chips items={user.languages} empty="No languages added yet." />
          </InfoCard>
        </div>
      </div>

      {/* Mounted only while open so the editor always seeds from the latest data. */}
      {canEdit && editOpen && <EditProfileDialog user={user} open onOpenChange={setEditOpen} />}
    </>
  )
}

function Meta({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon}<span>{label}</span></div>
      <p className="text-sm font-medium text-foreground truncate mt-0.5" title={value}>{value}</p>
    </div>
  )
}