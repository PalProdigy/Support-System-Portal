

'use client'

import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InfoCard, StatTile } from './shared'
import { EditProfileDialog } from './edit-profile-dialog'
import { ROLE_LABELS } from '@/lib/rbac'
import { getInitials, formatDate, formatDuration } from '@/lib/utils'
import {
  Pencil, Mail, Calendar, IdCard, Building2, Briefcase, Award, GraduationCap,
  Phone, Languages, Wrench, Sparkles, FileText, Download, Ticket, CheckCircle2,
  Clock, TrendingUp, Star, RotateCcw, AlertTriangle, Trophy, Zap, ShieldCheck, Medal,
} from 'lucide-react'
import type { Case, User, AchievementType } from '@/types'

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

export function SupportEngineerProfile({ user, teamName }: { user: User; teamName?: string }) {
  const dp = getDataProvider()
  const scope = { userId: user.id, role: user.role }
  const [editOpen, setEditOpen] = useState(false)

  const { data: metrics } = useQuery({
    queryKey: ['engineer-metrics', user.id],
    queryFn: () => dp.getEngineerMetrics(user.id, scope),
  })
  const { data: casesPage } = useQuery({
    queryKey: ['cases-by-engineer', user.id],
    queryFn: () => dp.listCases(scope, { assignee_id: user.id, pageSize: 500 }),
  })

  const cases: Case[] = casesPage?.items ?? []
  const reopened = cases.filter((c) => c.reopened_from_case_id).length
  const escalated = cases.filter((c) => c.is_escalated || c.status === 'escalated').length

  const designation = user.designation ?? ROLE_LABELS[user.role]
  const department = user.department === 'sales' ? 'Sales' : 'Technical'
  const employeeId = user.employee_id ?? user.id.toUpperCase()

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
                  {user.certification_level && (
                    <Badge variant="outline" className="font-mono gap-1"><Award className="h-3 w-3" /> {user.certification_level}</Badge>
                  )}
                  <Badge variant={user.is_active ? 'default' : 'destructive'}>{user.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit Profile
            </Button>
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

          <InfoCard title="Education" icon={<GraduationCap className="h-3.5 w-3.5" />}>
            {user.education && user.education.length > 0 ? (
              <div className="space-y-3">
                {user.education.map((e) => (
                  <div key={e.id} className="flex gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{e.degree || 'Qualification'}</p>
                      <p className="text-xs text-muted-foreground">{e.institution}{e.year ? ` · ${e.year}` : ''}</p>
                      {e.gpa && (
                        <p className="text-xs font-medium text-foreground mt-1 inline-flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px] font-mono">CGPA / GPA</Badge>
                          <span className="font-mono">{e.gpa}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No education added yet.</p>}
          </InfoCard>

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
          <InfoCard title="Performance Summary" icon={<TrendingUp className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile icon={<Ticket className="h-3.5 w-3.5 text-blue-500" />} label="Cases Assigned" value={String(cases.length)} />
              <StatTile icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />} label="Cases Resolved" value={String(metrics?.total_resolved ?? 0)} />
              <StatTile icon={<Ticket className="h-3.5 w-3.5 text-slate-400" />} label="Open Cases" value={String(metrics?.open_cases ?? 0)} />
              <StatTile icon={<Clock className="h-3.5 w-3.5 text-blue-400" />} label="Avg Resolution" value={metrics?.avg_resolution_hours != null ? formatDuration(metrics.avg_resolution_hours * 3_600_000) : '—'} />
              <StatTile icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-500" />} label="SLA Compliance" value={metrics?.sla_compliance_pct != null ? `${metrics.sla_compliance_pct.toFixed(0)}%` : '—'} />
              <StatTile icon={<Star className="h-3.5 w-3.5 text-yellow-500" />} label="Customer Rating" value={metrics?.satisfaction_score != null ? `${metrics.satisfaction_score.toFixed(1)}/5` : '—'} />
              <StatTile icon={<RotateCcw className="h-3.5 w-3.5 text-amber-500" />} label="Reopen Cases" value={String(reopened)} />
              <StatTile icon={<AlertTriangle className="h-3.5 w-3.5 text-red-500" />} label="Escalated" value={String(escalated)} />
            </div>
          </InfoCard>

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
      {editOpen && <EditProfileDialog user={user} open onOpenChange={setEditOpen} />}
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