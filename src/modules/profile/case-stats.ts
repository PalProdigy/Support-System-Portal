import type { Case, Feedback } from '@/types'

const DONE_STATUSES = ['resolved', 'pending_closure', 'closed']

export const isDone = (c: Case) => DONE_STATUSES.includes(c.status)
export const isOpen = (c: Case) => !isDone(c)
export const isEscalated = (c: Case) => c.is_escalated || c.status === 'escalated'

// Percentage of resolved cases that met their SLA deadline (null when none resolved).
export function slaCompliancePct(cases: Case[]): number | null {
  const done = cases.filter((c) => c.resolved_at)
  if (done.length === 0) return null
  const within = done.filter((c) => !c.sla_due_at || new Date(c.resolved_at!).getTime() <= new Date(c.sla_due_at).getTime())
  return (within.length / done.length) * 100
}

// Average client rating (1–5) across a feedback set (null when none rated).
export function avgRating(feedback: Feedback[]): number | null {
  const rated = feedback.filter((f) => f.rating != null)
  if (rated.length === 0) return null
  return rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length
}

// Points earned per resolved case, weighted by priority — higher-priority
// cases are harder / more time-critical to resolve, so they're worth more.
const POINTS_BY_PRIORITY: Record<Case['priority'], number> = {
  low: 5,
  medium: 10,
  high: 15,
  critical: 25,
}

// Total points an engineer has earned so far, from the cases they've resolved.
export function pointsForCases(cases: Case[]): number {
  return cases.filter(isDone).reduce((sum, c) => sum + (POINTS_BY_PRIORITY[c.priority] ?? 10), 0)
}