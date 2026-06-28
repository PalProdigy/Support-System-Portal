export type Role =
  | 'client'
  | 'account_manager'
  | 'support_engineer'
  | 'module_lead'
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

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'whatsapp' | 'web_push'

export type AuditAction = 'create' | 'update' | 'delete' | 'status_change' | 'assign' | 'escalate' | 'login' | 'logout'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  team_id?: string
  is_active: boolean
  avatar?: string
  created_at: string
}

export interface Client {
  id: string
  user_id: string
  company_name: string
  contact_person: string
  phone: string
  business_context: string
  pre_sales_notes?: string
  created_by: string
  created_at: string
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

export interface SolutionComment {
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
}

export interface CaseComment {
  id: string
  case_id: string
  author_id: string
  body: string
  is_internal: boolean
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
  status: 'draft' | 'published' | 'archived'
  author_id: string
  published_at?: string
  created_at: string
  updated_at: string
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

// ── Phase 1: Account Manager / Pre-sales ──────────────────────────────────────

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
  business_context: string
  pre_sales_notes?: string
  solution_ids: string[]
  prospect_id?: string
}