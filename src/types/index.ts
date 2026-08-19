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

// One entry in a user's educational background (e.g. BSc, HSC, SSC).
export interface EducationEntry {
  id: string
  degree: string        // e.g. "BSc in Computer Science"
  institution: string   // e.g. "University of Dhaka"
  year?: string         // graduation year, e.g. "2018"
  gpa?: string          // CGPA/GPA, e.g. "3.85 / 4.00"
}

// An uploaded certification document (PDF/DOC) with editable metadata.
export interface CertificationDoc {
  id: string
  title: string
  description?: string
  file_name?: string
  file_type?: string
  file_url?: string     // base64 data URL so it persists and stays downloadable
  size?: number
}

export type AchievementType =
  | 'employee_of_month'
  | 'best_sla'
  | 'fastest_resolution'
  | 'top_rating'
  | 'internal_award'

// An award/recognition earned by the engineer (display-only, not self-editable).
export interface Achievement {
  id: string
  type: AchievementType
  title: string
  description?: string
  date?: string
}

// Which broad department a staff member belongs to.
export type Department = 'technical' | 'sales'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  team_id?: string
  is_active: boolean
  avatar?: string
  created_at: string
  // Staff seniority profile fields — shown on the engineer and AM dashboards'
  // Certification card (optional; client/lead/TH roles leave these unset).
  years_of_experience?: number
  certification_level?: CertificationLevel
  // ── Extended profile (editable by the engineer) ──────────────────────────
  about?: string
  contact_numbers?: string[]
  languages?: string[]
  technical_skills?: string[]
  expertise?: string[]
  education?: EducationEntry[]
  certifications?: CertificationDoc[]
  // ── Extended profile (org-managed, display-only) ─────────────────────────
  designation?: string
  department?: Department
  employee_id?: string
  achievements?: Achievement[]
}

export interface Client {
  id: string
  // Only set when a portal login was created alongside the client (the full
  // "Create Client Account" flow) — a plain client created from the Clients
  // page has no linked user and no portal access.
  user_id?: string
  company_name: string
  contact_person: string
  contact_designation?: string
  phone: string
  email?: string
  industry?: string
  account_tier?: 'starter' | 'professional' | 'enterprise'
  account_status?: 'active' | 'at_risk' | 'churned'
  assigned_am?: string
  business_context?: string
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
  product_id?: string     // which product/OEM this solution write-up is for
  case_id?: string        // optional case this solution was derived from
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

// The OEM/vendor-side contact responsible for a product — captured when the
// product is added so there's always a point of contact on file. A product
// can have several (e.g. a primary and a backup), so they're kept as a list.
export interface ProductManager {
  id: string
  name: string
  email: string
  phone: string
  designation: string
  employee_id: string
  joining_date: string
}

export interface Product {
  id: string
  name: string
  description: string
  category: string
  is_active: boolean
  created_at: string
  image_urls?: string[]   // base64 data URLs uploaded from the Add/Edit Product form (max 5)
  managers?: ProductManager[]
}

export interface SLARule {
  id: string
  priority: Priority
  response_time_minutes: number
  resolution_time_minutes: number
  business_hours_only: boolean
}

// License + support (SLA) contract a client holds for a product. Expiry dates
// drive the Technical Head dashboard's renewal-risk widgets (expiring ≤ 7 days
// and already-expired).
export interface ProductLicense {
  id: string
  client_id: string
  product_id: string
  license_expires_at: string  // ISO — product license end
  sla_expires_at: string      // ISO — support/SLA contract end
  created_at: string
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
  updated_at?: string
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
  // Set when a closure attempt was rejected: a lead/TH sent a pending_closure
  // case back to work, or the client reopened a resolved case instead of
  // confirming the solution. Persists after re-resolution as history; the TH
  // dashboard surfaces open cases carrying this flag.
  closure_rejected?: boolean
  closure_rejected_at?: string
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
  // Planned start and end for sub-task scheduling
  started_at?: string
  estimated_end_at?: string
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
  uploaded_by_name?: string
  file_url: string
  file_name: string
  file_type: string
  category: string
  source?: string
  size: number
  created_at: string
}

export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'

export interface Project {
  id: string
  title: string
  description?: string
  client_id: string
  product_id?: string      // which product/OEM this project is for
  handler_ids: string[]   // engineers/leads handling this project — can be multiple
  status: ProjectStatus
  priority?: Priority
  parent_project_id?: string   // set on a sub task — a real, independently trackable child project
  started_at?: string
  estimated_end_at?: string
  created_by: string
  created_at: string
  updated_at?: string
}

export interface ProjectComment {
  id: string
  project_id: string
  author_id: string
  body: string
  created_at: string
}

export interface ProjectAttachment {
  id: string
  project_id: string
  uploaded_by: string
  file_url: string
  file_name: string
  file_type: string
  size: number
  created_at: string
}

// An external email address (client-side stakeholder, vendor contact, etc.)
// CC'd on a Case or a Project — just the address, not an app User. Exactly
// one of case_id/project_id is set.
export interface ExternalMember {
  id: string
  case_id?: string
  project_id?: string
  email: string
  created_at: string
}

export type EngagementType = 'installation' | 'poc' | 'support'
// Every engagement sits in this one state — waiting on the client to move
// forward with the installation/POC/support work. No in-progress/completed/
// cancelled lifecycle is tracked.
export type EngagementStatus = 'open'

// A named point of contact at a client — searchable/reusable across engagements
// instead of being re-typed as free text every time.
export interface ClientContact {
  id: string
  client_id: string
  name: string
  email: string
  phone?: string
  designation?: string
  created_at: string
}

// One product line within an engagement — its own type(s) (installation/POC/
// support — a line can be more than one at once, e.g. Installation + Support),
// the OEM/brand and specific product under it (both drawn from the real
// Product catalog, since a Product's `category` field already holds its OEM
// name), and its own client representative(s) — the point of contact for
// that particular product.
export interface EngagementProductLine {
  id: string
  types: EngagementType[]
  oem: string
  product_id: string
  placed_at?: string      // when this product/service was placed (ordered)
  expires_at?: string     // when it's due to expire
  contact_ids: string[]   // ClientContact ids — can have multiple representatives
  // Technical Head assignment — the poc/support portion of a line routes to a
  // Team; the installation portion routes to one-or-more engineers directly
  // (first = Primary). A line with both is only fully assigned once both are set.
  assigned_team_id?: string
  assigned_handler_ids?: string[]
  assigned_at?: string
  project_id?: string     // set once the installation portion spawns a real Project
  // Outcome tracking for the poc portion of a line — unset once assigned means
  // still running; only meaningful once assigned_team_id is set.
  poc_outcome?: 'running' | 'success' | 'failed'
}

// A discrete piece of field work with a client — one or more product lines,
// each independently an installation, a proof of concept, or a support
// engagement — distinct from a Case (a support ticket) and a Project (a
// longer-running body of work). Customer PO is engagement-wide (not per
// product) and is only relevant once something is actually being purchased —
// i.e. when at least one product line isn't a POC.
export interface Engagement {
  id: string
  client_id: string
  customer_po?: string
  products: EngagementProductLine[]
  status: EngagementStatus
  created_by: string
  created_at: string
  updated_at?: string
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

// ── Knowledge Base ────────────────────────────────────────────────────────────
// Article lifecycle: draft → in_review → (changes_requested → draft →) approved
// → published → archived. Legacy values 'pending'/'rejected' are migrated to
// 'in_review'/'changes_requested' by the data layer on read.
export type KBArticleStatus =
  | 'draft'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'published'
  | 'archived'

// One workflow transition — every status change is tracked.
export interface KBStatusEvent {
  from: KBArticleStatus | null
  to: KBArticleStatus
  by: string
  by_name?: string
  at: string
  note?: string          // e.g. the reviewer's "changes requested" note
}

// Full content snapshot taken BEFORE an edit is applied; enables compare/restore.
export interface KBArticleVersion {
  version: number
  title: string
  description?: string
  body: string           // markdown only — HTML is never stored
  category?: string
  subcategory?: string
  tags: string[]
  saved_at: string
  saved_by: string
  saved_by_name?: string
}

export interface KBArticle {
  id: string
  slug?: string          // unique, SEO-friendly; server owns uniqueness
  title: string
  description?: string   // short summary shown on cards / search / meta description
  body: string           // markdown source — the single source of truth
  category?: string
  subcategory?: string
  solution_id?: string
  product_id?: string
  tags: string[]
  status: KBArticleStatus
  version?: number                  // current version number (starts at 1)
  versions?: KBArticleVersion[]     // previous snapshots, oldest → newest
  status_history?: KBStatusEvent[]
  author_id: string
  author_name?: string
  author_role?: Role
  reviewer_id?: string   // last TL/TH who acted on the review
  reviewer_name?: string
  published_at?: string
  published_by?: string        // user id of the reviewer who published
  rejected_by?: string
  rejection_reason?: string    // the active "changes requested" note
  created_at: string
  updated_at: string
  comments?: ThreadComment[]
}

// ── Solution Articles (in-house Knowledge Base) ──────────────────────────────
// Long-form markdown articles authored in the portal (Hashnode-like writing
// experience, our own storage). The database stores ONLY markdown — rendered
// HTML is never persisted; the viewer renders `content` dynamically.
export type SolutionArticleStatus = 'draft' | 'published'

export interface SolutionArticle {
  id: string
  title: string
  slug: string                 // unique, URL-safe; server owns uniqueness
  description: string          // short summary shown on cards / meta
  content: string              // Markdown source (GFM) — the single source of truth
  category?: string
  tags: string[]
  solution_id?: string         // set when this article is the write-up for a catalogue Solution
  product_id?: string          // which product this article/solution is for
  cover_image_url?: string
  status: SolutionArticleStatus // always 'published' today; enables drafts later
  created_by: string           // user id
  created_by_name?: string
  created_by_role?: Role
  updated_by?: string
  updated_by_name?: string
  created_at: string
  updated_at: string
  // Engagement
  likes?: string[]        // user ids who liked
  dislikes?: string[]     // user ids who disliked
  comments?: SolutionComment[]
}

export interface Feedback {
  id: string
  case_id: string
  client_id: string
  feedback_text: string
  rating?: number   // overall score — the average of question_ratings when present
  question_ratings?: Record<string, number>   // per-question 1-5 scores, keyed by FEEDBACK_QUESTIONS[].key
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

// ── RBAC ────────────────────────────────────────────────────────────────────
// Declared here (rather than in src/lib/rbac) so both the RBAC engine and
// domain types like PermissionOverride can reference them without a circular
// import — rbac/index.ts imports and re-exports these as the source of truth.
export type PermissionAction =
  | 'create' | 'read' | 'update' | 'delete'
  | 'assign' | 'escalate' | 'resolve' | 'close' | 'reopen'
  | 'triage' | 'change_status'
  | 'create_internal_comment'
  | 'manage_users' | 'manage_teams' | 'manage_solutions'
  | 'manage_products' | 'manage_kb' | 'manage_sla' | 'manage_permissions'
  | 'view_audit_log' | 'view_all_cases' | 'view_feedback'
  | 'review_feedback'
  | 'manage_prospects' | 'create_client_account'
  | 'handle_all_cases' | 'handle_team_cases'
  | 'add_engineer' | 'add_sales_executive'
  | 'manage_projects' | 'manage_orders'

export type PermissionResource =
  | 'case' | 'comment' | 'internal_comment' | 'attachment' | 'rca'
  | 'user' | 'client' | 'solution' | 'team' | 'product'
  | 'kb_article' | 'sla_rule' | 'feedback' | 'audit_log'
  | 'notification' | 'system_settings'
  | 'prospect' | 'pre_sales_note'
  | 'project' | 'engagement'

// A per-user grant/revoke on top of their role's default permissions —
// 'allow' opens up something their role wouldn't normally have, 'deny' locks
// down something their role would. Looked up by (user_id, resource, action);
// at most one override should exist per triple (upserted, not appended).
export interface PermissionOverride {
  id: string
  user_id: string
  resource: PermissionResource
  action: PermissionAction
  effect: 'allow' | 'deny'
  granted_by: string
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
  points: number // earned by resolving cases, weighted by priority
}

// Phase Final — Sales Executive performance (computed, not persisted, except
// `target` which mirrors the currently assigned SalesTarget row).
export interface SalesExecutiveMetrics {
  sales_executive_id: string
  target: SalesTarget | null
  achieved_amount: number          // sum of estimated_value across closed_won prospects
  achievement_pct: number | null   // achieved_amount / target.target_amount * 100
  pipeline_value: number           // sum of estimated_value across open (non-closed) prospects
  active_prospects: number
  deals_won: number
  deals_lost: number
  win_rate_pct: number | null      // deals_won / (deals_won + deals_lost) * 100
  active_clients: number           // clients with assigned_am === sales_executive_id
  last_deal: { company_name: string; value: number; closed_at: string } | null
}

// Phase Final — Per-user notification channel preferences
export interface UserNotificationPrefs {
  user_id: string
  channels: NotificationChannel[]
  sms_phone?: string
  whatsapp_phone?: string
  // Notification `type` values (see src/lib/notification-types.ts) the user
  // has muted — suppressed across every channel, including in-app.
  disabled_types?: string[]
}

// ── Phase 1: Sales Executive / Pre-sales ──────────────────────────────────────

export type ProspectStage =
  | 'discovery'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost'

// Deal classification once a prospect is closed — what kind of engagement it is,
// independent of stage/outcome (a lost deal can still have been a Renewal pitch).
export type DealType = 'installation' | 'renewal' | 'poc'

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
  deal_type?: DealType
  // Only set once the deal is won and a license is actually issued.
  license_expiry?: string
  created_by: string
  created_at: string
  updated_at: string
  converted_client_id?: string
}

// A revenue quota assigned to a Sales Executive for a period (set by the
// Technical Head). Achievement against it is computed, not stored here —
// see SalesExecutiveMetrics.
export interface SalesTarget {
  id: string
  sales_executive_id: string
  period_label: string   // e.g. "Q1 2025"
  period_start: string
  period_end: string
  target_amount: number
  assigned_by: string     // technical_head user id
  assigned_at: string
  notes?: string
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

// A support engineer's request to grab (self-assign) a newly routed case.
// Creating one does NOT assign the case — the TL/TH sees the requesting
// engineer's name on the case card with Accept/Reject; approving assigns the
// case to that engineer and auto-rejects competing claims for the same case.
export interface CaseClaimRequest {
  id: string
  case_id: string
  engineer_id: string
  engineer_name?: string          // denormalized for card display
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  resolved_by?: string            // TL/TH who decided
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