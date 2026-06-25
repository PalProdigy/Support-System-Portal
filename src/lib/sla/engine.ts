// SLA Engine — interface designed so it can move to a real backend cron later.
// The client-side runner (mock-runner.ts) swaps for a backend poller when
// NEXT_PUBLIC_DATA_SOURCE='api'.

export type SLAEventType =
  | 'at_risk'            // 80% SLA elapsed, not yet breached
  | 'breached'           // SLA deadline passed
  | 'unassigned_too_long' // triaged/new with no assignee for > 30 min → auto-escalate
  | 'engineer_idle'      // engineer has been sitting on in_progress too long

export interface SLAEvent {
  id: string
  case_id: string
  type: SLAEventType
  fired_at: string
}

export interface SLARunResult {
  fired: SLAEvent[]
}

export interface SLAEngineRunner {
  run(): Promise<SLARunResult>
}

export const SLA_EVENTS_STORAGE_KEY = 'nhq_sla_events'

// Thresholds
export const UNASSIGNED_TIMEOUT_MS = 30 * 60 * 1000      // 30 minutes
export const IDLE_THRESHOLD_MS     = 4 * 60 * 60 * 1000  // 4 hours
export const AT_RISK_PCT           = 80                   // % SLA elapsed