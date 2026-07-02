import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Priority, CaseStatus, ClientInfoReason } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', ...opts,
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export function slaPercent(createdAt: string, dueAt: string): number {
  const total = new Date(dueAt).getTime() - new Date(createdAt).getTime()
  const elapsed = Date.now() - new Date(createdAt).getTime()
  if (total <= 0) return 100
  return Math.min(100, Math.round((elapsed / total) * 100))
}

export function slaRemainingMs(dueAt: string): number {
  return new Date(dueAt).getTime() - Date.now()
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return 'Overdue'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m`
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`
}

// Sum of all worked intervals in ms. A closed interval contributes (end - start);
// an open interval (no end) contributes up to `nowMs`. Paused gaps are excluded
// because they simply aren't part of any interval.
export function sumIntervalsMs(
  intervals: { start: string; end?: string }[] | undefined,
  nowMs: number = Date.now(),
): number {
  if (!intervals) return 0
  return intervals.reduce((total, iv) => {
    const start = new Date(iv.start).getTime()
    const end = iv.end ? new Date(iv.end).getTime() : nowMs
    return total + Math.max(0, end - start)
  }, 0)
}

// HH:MM:SS clock-style formatter for tracked time (always shows hours).
export function formatTracked(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  low:      'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  medium:   'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-300',
  high:     'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300',
  critical: 'bg-red-600 text-white dark:bg-red-500 dark:text-white',
}

export const PRIORITY_DOT: Record<Priority, string> = {
  low:      'bg-slate-500',
  medium:   'bg-sky-500',
  high:     'bg-orange-500',
  critical: 'bg-white/80',
}

export const STATUS_COLORS: Record<CaseStatus, string> = {
  new:             'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
  triaged:         'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300',
  assigned:        'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-300',
  in_progress:     'bg-blue-600 text-white dark:bg-blue-500 dark:text-white',
  pending_client:  'bg-amber-500 text-white dark:bg-amber-500 dark:text-white',
  resolved:        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300',
  pending_closure: 'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-300',
  closed:          'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  escalated:       'bg-red-600 text-white dark:bg-red-500 dark:text-white',
}

export const STATUS_LABELS: Record<CaseStatus, string> = {
  new: 'New',
  triaged: 'Triaged',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending_client: 'Pending Client',
  resolved: 'Resolved',
  pending_closure: 'Pending Closure',
  closed: 'Closed',
  escalated: 'Escalated',
}

// Friendly labels for the reasons an engineer requests information from a client.
export const CLIENT_INFO_REASON_LABELS: Record<ClientInfoReason, string> = {
  screenshot: 'Need Screenshot',
  log: 'Need Log',
  approval: 'Need Approval',
  testing: 'Need Testing',
  access: 'Need Access',
  more_info: 'Need More Information',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

// Valid status transitions (from → to[])
export const STATUS_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  new: ['triaged'],
  triaged: ['assigned'],
  assigned: ['in_progress'],
  in_progress: ['pending_client', 'resolved', 'escalated'],
  pending_client: ['in_progress', 'resolved'],
  resolved: ['pending_closure', 'in_progress'],
  pending_closure: ['closed', 'in_progress'],
  closed: ['in_progress'],  // reopen
  escalated: ['in_progress', 'resolved'],
}

export function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export const CLIENT_STATUS_LABELS: Record<CaseStatus, string> = {
  new: 'Received',
  triaged: 'Under Review',
  assigned: 'Assigned to Team',
  in_progress: 'In Progress',
  pending_client: 'Awaiting Your Response',
  resolved: 'Resolved',
  pending_closure: 'Pending Closure',
  closed: 'Closed',
  escalated: 'Escalated',
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}