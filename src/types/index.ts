export type Role =
  | 'client'
  | 'sales_executive'
  | 'support_engineer'
  | 'team_lead'
  | 'technical_head'

export type Priority = 'low' | 'medium' | 'high' | 'critical'

export type CaseStatus =
  | 'new'
  | 'triaged'
  | 'assigned'
  | 'in_progress'
  | 'pending_client'
  | 'resolved'
  | 'pending_closure'
  | 'closed'
  | 'escalated'

// Reason categories an engineer can pick when requesting information from the
// client (drives the "Pending Client" prompt shown to the client).
export type ClientInfoReason =
  | 'screenshot'
  | 'log'
  | 'approval'
  | 'testing'
  | 'access'
  | 'more_info'

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'whatsapp' | 'web_push'

export type AuditAction = 'create' | 'update' | 'delete' | 'status_change' | 'assign' | 'escalate' | 'login' | 'logout'

// Skill/certification tier for support engineers (L1 = junior … L5 = expert).
export type CertificationLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  team_id?: string
  is_active: boolean
  avatar?: string
  created_at: string
  // Support-engineer profile fields (optional; other roles leave these unset).
  years_of_experience?: number
  certification_level?: CertificationLevel
}

export interface Client {
  id: string
  user_id: string
  company_name: string
  contact_person: string
  phone: string
  email?: string
  industry?: string
  account_tier?: 'starter' | 'professional' | 'enterprise'
  account_status?: 'active' | 'at_risk' | 'churned'
  assigned_am?: string
  business_context: string
  pre_sales_notes?: string
  last_activity_at?: string
  created_by: string
  created_at: string
}

export interface PreSalesNote {
  id: string
  client_id: string
  author_id: string
  author_name: string
  body: string
  created_at: string
  updated_at?: string
}

export interface Solution {
  id: string
  name: string
  description: string
  details: string
  category: string
  is_active: boolean
  created_at: string
  // Auto-captured author metadata (set from the logged-in user on save)
  author_id?: string
  author_name?: string
  author_role?: Role
  updated_at?: string
  // Engagement
  likes?: string[]        // user ids who liked
  dislikes?: string[]     // user ids who disliked
  comments?: SolutionComment[]
}

// Generic threaded comment shape — shared by any entity that supports nested
// comments with per-comment like/dislike (solutions, KB articles, …).
export interface ThreadComment {
  id: string
  parent_id?: string | null   // null/undefined = top-level; otherwise the parent comment id
  author_id: string
  author_name: string
  author_role?: Role
  body: string
  created_at: string
  likes?: string[]            // user ids who liked this comment
  dislikes?: string[]         // user ids who disliked this comment
}

// Backward-compatible alias for existing Solution code.
export type SolutionComment = ThreadComment

export interface ClientSolution {
  id: string
  client_id: string
  solution_id: string
  created_at: string
}

export interface Team {
  id: string
  name: string
  lead_user_id: string
  solution_ids?: string[]
  is_active?: boolean
  created_at: string
}

export interface Product {
  id: string
  name: string
  description: string
  category: string
  is_active: boolean
  created_at: string
}

export interface SLARule {
  id: string
  priority: Priority
  response_time_minutes: number
  resolution_time_minutes: number
  business_hours_only: boolean
}

export interface Case {
  id: string
  reference_no: string
  title: string
  description: string
  client_id: string
  solution_id: string
  product_id?: string
  team_id: string
  assignee_id?: string
  co_assignee_ids?: string[]
  priority: Priority
  status: CaseStatus
  sla_rule_id: string
  sla_due_at: string
  escalation_level: number
  created_at: string
  resolved_at?: string
  closed_at?: string
  is_escalated: boolean
  // Phase 5: TH must approve critical resolutions before ML can close
  th_approved?: boolean
  // Service-based routing & team-lead approval (30-minute window before escalation).
  // The case is routed to the team whose solution_ids include this case's solution_id;
  // that team's lead must accept within the window or it escalates to the Technical Head.
  approval_status?: CaseApprovalStatus
  approval_team_id?: string      // the team the case was routed to (by service match)
  approval_user_id?: string      // who must respond now (team lead, or TH after escalation)
  approval_deadline?: string     // ISO deadline for a response (created_at + 30 min)
  approval_escalated_at?: string // ISO time the approval escalated to the Technical Head
  // Sub-cases: a child case nested under a parent for time-tracked work items
  parent_case_id?: string
  // Reopen lineage: when a fully-closed case is reopened, a NEW case is created
  // that carries the old case's data forward and links back to the original via
  // this field. Undefined on genuinely new cases (nothing to show).
  reopened_from_case_id?: string
  // Why the engineer moved the case to Pending Client (set by requestClientInfo).
  // Surfaced to the client so they know exactly what is needed.
  pending_client_reason?: ClientInfoReason
  pending_client_message?: string
  // Resolution details captured when the engineer clicks "Mark Resolved".
  // Mirrored into an RCA record too (see resolveCase) for the reopen-lineage view.
  root_cause?: string
  resolution_summary?: string
  resolution_solution?: string
  resolution_notes?: string
  // Denormalized flag: true while a client-raised Engineer Change Request is
  // awaiting a Team Lead / Technical Head decision. Drives the warning badge.
  has_pending_engineer_change?: boolean
  // Time tracking (used by sub-cases). Intervals are the source of truth for
  // total worked time and are persisted so totals survive reloads.
  time_intervals?: TimeInterval[]
  timer_status?: TimerStatus
}

// A single work interval. `end` undefined means the timer is currently running.
export interface TimeInterval {
  start: string   // ISO timestamp
  end?: string    // ISO timestamp; undefined while running
}

export type TimerStatus = 'not_started' | 'running' | 'paused' | 'ended'

// Team-lead approval lifecycle for a newly routed case.
export type CaseApprovalStatus = 'pending' | 'accepted' | 'escalated'

export interface CaseComment {
  id: string
  case_id: string
  author_id: string
  body: string
  is_internal: boolean
  parent_id?: string | null   // null/undefined = top-level; otherwise the parent comment id
  created_at: string
}

export interface Attachment {
  id: string
  case_id: string
  uploaded_by: string
  file_url: string
  file_name: string
  file_type: string
  category: string
  size: number
  created_at: string
}

export interface RCA {
  id: string
  case_id: string
  problem: string
  root_cause: string
  resolution: string
  prevention: string
  created_by: string
  created_at: string
}

export interface KBArticle {
  id: string
  title: string
  body: string
  solution_id?: string
  product_id?: string
  tags: string[]
  status: 'draft' | 'pending' | 'published' | 'rejected' | 'archived'
  author_id: string
  author_name?: string
  author_role?: Role
  published_at?: string
  published_by?: string        // user id of the Technical Head who approved
  rejected_by?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
  comments?: ThreadComment[]
}

export interface Feedback {
  id: string
  case_id: string
  client_id: string
  feedback_text: string
  rating?: number
  ml_reviewed?: boolean
  th_reviewed?: boolean
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  channel: NotificationChannel
  type: string
  payload: Record<string, unknown>
  read_at?: string
  sent_at: string
}

export interface AuditLog {
  id: string
  actor_id: string
  entity_type: string
  entity_id: string
  action: AuditAction
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  created_at: string
}

// Session
export interface Session {
  userId: string
  role: Role
  impersonatedUserId?: string
}

// Phase Final — Performance metrics (computed, not persisted)
export interface EngineerMetrics {
  engineer_id: string
  total_resolved: number
  avg_resolution_hours: number | null
  sla_compliance_pct: number
  satisfaction_score: number | null // avg of feedback ratings (1–5)
  open_cases: number
  total_feedback_count: number
}

// Phase Final — Per-user notification channel preferences
export interface UserNotificationPrefs {
  user_id: string
  channels: NotificationChannel[]
}

// ── Phase 1: Sales Executive / Pre-sales ──────────────────────────────────────

export type ProspectStage =
  | 'discovery'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost'

export interface Prospect {
  id: string
  company_name: string
  contact_person: string
  phone: string
  email?: string
  business_context: string
  stage: ProspectStage
  notes?: string
  estimated_value?: number
  created_by: string
  created_at: string
  updated_at: string
  converted_client_id?: string
}

// A client-raised request to change the engineer assigned to their case.
// Creating one does NOT change case status — the case stays In Progress and a
// warning badge is shown until a Team Lead / Technical Head approves or rejects.
export interface EngineerChangeRequest {
  id: string
  case_id: string
  requested_by: string            // client user id
  current_engineer_id?: string    // engineer at time of request
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  resolved_by?: string            // TL/TH who approved or rejected
  new_engineer_id?: string        // set when approved
  created_at: string
  resolved_at?: string
}

export interface CaseTransferRequest {
  id: string
  team_id: string
  case_id: string
  requested_by: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface TeamMemberRequest {
  id: string
  team_id: string
  type: 'add' | 'remove'
  requested_by: string
  user_ids: string[]
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface CreateClientAccountInput {
  company_name: string
  contact_person: string
  phone: string
  email?: string
  business_context: string
  pre_sales_notes?: string
  solution_ids: string[]
  prospect_id?: string
}