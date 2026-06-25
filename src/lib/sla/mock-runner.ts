// Client-side SLA engine that reads/writes localStorage directly.
// Bypasses the DataProvider 50ms delay simulation for background operation.
// Replace with a backend poller when moving to production.

import type { SLAEngineRunner, SLARunResult, SLAEvent, SLAEventType } from './engine'
import { SLA_EVENTS_STORAGE_KEY, UNASSIGNED_TIMEOUT_MS, IDLE_THRESHOLD_MS, AT_RISK_PCT } from './engine'
import type { Case, User, Team, Notification, AuditLog } from '@/types'

// Storage key constants — must stay in sync with mock/index.ts STORAGE_KEYS
const KEYS = {
  cases:         'nhq_cases',
  users:         'nhq_users',
  teams:         'nhq_teams',
  notifications: 'nhq_notifications',
  auditLogs:     'nhq_audit_logs',
  slaEvents:     SLA_EVENTS_STORAGE_KEY,
} as const

function read<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as T[] } catch { return [] }
}
function write<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data))
}
function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
function nowIso(): string { return new Date().toISOString() }

function makeNotif(userId: string, type: string, c: Case): Notification {
  return {
    id: uid(),
    user_id: userId,
    channel: 'in_app',
    type,
    payload: { case_id: c.id, reference_no: c.reference_no, title: c.title },
    sent_at: nowIso(),
  }
}

const OPEN_STATUSES = new Set(['new', 'triaged', 'assigned', 'in_progress', 'pending_client', 'escalated'])

export function makeSLARunner(): SLAEngineRunner {
  return {
    async run(): Promise<SLARunResult> {
      if (typeof window === 'undefined') return { fired: [] }

      const cases     = read<Case>(KEYS.cases)
      const users     = read<User>(KEYS.users)
      const teams     = read<Team>(KEYS.teams)
      const fired     = read<SLAEvent>(KEYS.slaEvents)

      const hasFired = (caseId: string, type: SLAEventType) =>
        fired.some((e) => e.case_id === caseId && e.type === type)

      const newEvents:       SLAEvent[]    = []
      const newNotifs:       Notification[] = []
      const caseMutations:   Map<string, Partial<Case>> = new Map()
      const newAuditLogs:    AuditLog[]   = []

      const now = Date.now()

      for (const c of cases) {
        if (!OPEN_STATUSES.has(c.status)) continue

        const dueMs      = new Date(c.sla_due_at).getTime()
        const createdMs  = new Date(c.created_at).getTime()
        const totalMs    = dueMs - createdMs
        const elapsedMs  = now - createdMs
        const pct        = totalMs > 0 ? (elapsedMs / totalMs) * 100 : 100

        const team   = teams.find((t) => t.id === c.team_id)
        const mlId   = team?.lead_user_id
        const thIds  = users.filter((u) => u.role === 'technical_head' && u.is_active).map((u) => u.id)
        const amIds  = users.filter((u) => u.role === 'account_manager' && u.is_active).map((u) => u.id)

        // ── 1. At-risk (≥80% elapsed, deadline not yet passed) ────────────────
        if (pct >= AT_RISK_PCT && now < dueMs && !hasFired(c.id, 'at_risk')) {
          const targets = new Set<string>()
          if (c.assignee_id) targets.add(c.assignee_id)
          if (mlId) targets.add(mlId)
          targets.forEach((id) => newNotifs.push(makeNotif(id, 'sla_at_risk', c)))
          newEvents.push({ id: uid(), case_id: c.id, type: 'at_risk', fired_at: nowIso() })
        }

        // ── 2. SLA breach ─────────────────────────────────────────────────────
        if (now >= dueMs && !hasFired(c.id, 'breached')) {
          const targets = new Set<string>()
          if (mlId) targets.add(mlId)
          thIds.forEach((id) => targets.add(id))
          amIds.forEach((id) => targets.add(id))
          targets.forEach((id) => newNotifs.push(makeNotif(id, 'sla_breached', c)))
          newEvents.push({ id: uid(), case_id: c.id, type: 'breached', fired_at: nowIso() })
        }

        // ── 3. Unassigned too long → auto-escalate ────────────────────────────
        const isUnassignedTooLong =
          !c.assignee_id &&
          (c.status === 'new' || c.status === 'triaged') &&
          elapsedMs > UNASSIGNED_TIMEOUT_MS &&
          !c.is_escalated &&
          !hasFired(c.id, 'unassigned_too_long')

        if (isUnassignedTooLong) {
          caseMutations.set(c.id, {
            is_escalated: true,
            status: 'escalated',
            escalation_level: (c.escalation_level ?? 0) + 1,
          })
          newAuditLogs.push({
            id: uid(), actor_id: 'system', action: 'escalate', entity_type: 'case', entity_id: c.id,
            before: { status: c.status, is_escalated: false },
            after:  { status: 'escalated', is_escalated: true },
            created_at: nowIso(),
          })
          thIds.forEach((id) => newNotifs.push(makeNotif(id, 'case_auto_escalated', c)))
          newEvents.push({ id: uid(), case_id: c.id, type: 'unassigned_too_long', fired_at: nowIso() })
        }

        // ── 4. Engineer idle alert ────────────────────────────────────────────
        const isIdle =
          c.status === 'in_progress' &&
          c.assignee_id &&
          elapsedMs > IDLE_THRESHOLD_MS &&
          !hasFired(c.id, 'engineer_idle')

        if (isIdle) {
          const targets = new Set<string>()
          targets.add(c.assignee_id!)
          if (mlId) targets.add(mlId)
          targets.forEach((id) => newNotifs.push(makeNotif(id, 'engineer_idle_alert', c)))
          newEvents.push({ id: uid(), case_id: c.id, type: 'engineer_idle', fired_at: nowIso() })
        }
      }

      // ── Flush mutations ────────────────────────────────────────────────────
      if (caseMutations.size > 0) {
        const updatedCases = cases.map((c) => {
          const patch = caseMutations.get(c.id)
          return patch ? { ...c, ...patch } : c
        })
        write(KEYS.cases, updatedCases)
      }
      if (newAuditLogs.length > 0) {
        write(KEYS.auditLogs, [...read<AuditLog>(KEYS.auditLogs), ...newAuditLogs])
      }
      if (newEvents.length > 0) {
        write(KEYS.slaEvents, [...fired, ...newEvents])
      }
      if (newNotifs.length > 0) {
        write(KEYS.notifications, [...read<Notification>(KEYS.notifications), ...newNotifs])
      }

      return { fired: newEvents }
    },
  }
}
