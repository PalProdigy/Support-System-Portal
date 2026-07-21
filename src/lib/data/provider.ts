import type {
  User, Client, Solution, ClientSolution, Team, Product,
  SLARule, Case, CaseComment, Attachment, RCA, KBArticle,
  Feedback, Notification, AuditLog, Role,
  Prospect, CreateClientAccountInput,
  EngineerMetrics, SalesExecutiveMetrics, UserNotificationPrefs, NotificationChannel,
  TeamMemberRequest, CaseTransferRequest,
  ClientInfoReason, EngineerChangeRequest, CaseClaimRequest,
  SolutionArticle, SolutionArticleStatus,
} from '@/types'

export interface SolutionArticleFilters {
  status?: SolutionArticleStatus
  category?: string
  tag?: string
  search?: string   // matches title, description, tags and markdown content
}

// Server assigns id, slug (unique), created_at and updated_at. `content` is
// markdown only — rendered HTML must never be sent to or stored by the backend.
export type CreateSolutionArticleInput = Omit<
  SolutionArticle, 'id' | 'slug' | 'created_at' | 'updated_at'
> & { slug?: string }

export interface ListScope {
  userId: string
  role: Role
}

export interface KBArticleFilters {
  status?: string
  search?: string
  category?: string
  tag?: string
}

export interface CaseFilters {
  status?: string
  priority?: string
  client_id?: string
  assignee_id?: string
  team_id?: string
  search?: string
  page?: number
  pageSize?: number
  // When true, only top-level cases are returned (sub-cases, which have a
  // parent_case_id, are excluded). Used by the main Cases list so sub tasks are
  // reached only from their parent's detail page, not shown as standalone cases.
  top_level_only?: boolean
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface DataProvider {
  // Users
  listUsers(): Promise<User[]>
  getUser(id: string): Promise<User | null>
  createUser(input: Omit<User, 'id' | 'created_at'>): Promise<User>
  updateUser(id: string, patch: Partial<User>): Promise<User>
  deleteUser(id: string): Promise<void>

  // Clients
  listClients(scope: ListScope): Promise<Client[]>
  getClient(id: string): Promise<Client | null>
  createClient(input: Omit<Client, 'id' | 'created_at'>): Promise<Client>
  updateClient(id: string, patch: Partial<Client>): Promise<Client>

  // Solutions
  listSolutions(): Promise<Solution[]>
  getSolution(id: string): Promise<Solution | null>
  createSolution(input: Omit<Solution, 'id' | 'created_at'>): Promise<Solution>
  updateSolution(id: string, patch: Partial<Solution>): Promise<Solution>
  deleteSolution(id: string): Promise<void>
  // Engagement — dedicated, atomic actions (backend maps these to REST endpoints):
  //   toggleSolutionLike            → POST   /solutions/:id/like        { user_id }
  //   toggleSolutionDislike         → POST   /solutions/:id/dislike     { user_id }
  //   addSolutionComment            → POST   /solutions/:id/comments    { author_id, author_name, author_role, body, parent_id }  (server assigns id/created_at)
  //   deleteSolutionComment         → DELETE /solutions/:id/comments/:commentId   (also removes descendant replies)
  //   toggleSolutionCommentReaction → POST   /solutions/:id/comments/:commentId/reaction { user_id, reaction }
  // Each returns the updated Solution so the UI can reconcile in one round-trip.
  toggleSolutionLike(id: string, userId: string): Promise<Solution>
  toggleSolutionDislike(id: string, userId: string): Promise<Solution>
  addSolutionComment(id: string, input: { author_id: string; author_name: string; author_role?: Role; body: string; parent_id?: string | null }): Promise<Solution>
  deleteSolutionComment(id: string, commentId: string): Promise<Solution>
  toggleSolutionCommentReaction(id: string, commentId: string, userId: string, reaction: 'like' | 'dislike'): Promise<Solution>

  // Solution Articles — in-house Knowledge Base (markdown-only storage).
  // REST mapping once the backend exists:
  //   listSolutionArticles      → GET    /solution-articles?status=&category=&tag=&search=
  //   getSolutionArticle        → GET    /solution-articles/:id
  //   getSolutionArticleBySlug  → GET    /solution-articles/slug/:slug
  //   createSolutionArticle     → POST   /solution-articles      (server assigns id/slug/timestamps)
  //   updateSolutionArticle     → PATCH  /solution-articles/:id  (server refreshes updated_at/updated_by)
  //   deleteSolutionArticle     → DELETE /solution-articles/:id
  listSolutionArticles(filters?: SolutionArticleFilters): Promise<SolutionArticle[]>
  getSolutionArticle(id: string): Promise<SolutionArticle | null>
  getSolutionArticleBySlug(slug: string): Promise<SolutionArticle | null>
  createSolutionArticle(input: CreateSolutionArticleInput): Promise<SolutionArticle>
  updateSolutionArticle(id: string, patch: Partial<SolutionArticle>): Promise<SolutionArticle>
  deleteSolutionArticle(id: string): Promise<void>

  // Client Solutions
  listClientSolutions(clientId?: string): Promise<ClientSolution[]>
  addClientSolution(clientId: string, solutionId: string): Promise<ClientSolution>
  removeClientSolution(id: string): Promise<void>

  // Teams
  listTeams(): Promise<Team[]>
  getTeam(id: string): Promise<Team | null>
  createTeam(input: Omit<Team, 'id' | 'created_at'>): Promise<Team>
  updateTeam(id: string, patch: Partial<Team>): Promise<Team>

  // Products
  listProducts(): Promise<Product[]>
  getProduct(id: string): Promise<Product | null>
  createProduct(input: Omit<Product, 'id' | 'created_at'>): Promise<Product>
  updateProduct(id: string, patch: Partial<Product>): Promise<Product>

  // SLA Rules
  listSLARules(): Promise<SLARule[]>
  getSLARule(id: string): Promise<SLARule | null>
  upsertSLARule(rule: SLARule): Promise<SLARule>

  // Cases
  listCases(scope: ListScope, filters?: CaseFilters): Promise<Paginated<Case>>
  getCase(id: string, scope: ListScope): Promise<Case | null>
  createCase(input: Omit<Case, 'id' | 'reference_no' | 'created_at'>, scope: ListScope): Promise<Case>
  updateCase(id: string, patch: Partial<Case>, scope: ListScope): Promise<Case>
  assignCase(caseId: string, assigneeId: string, scope: ListScope): Promise<Case>
  escalateCase(caseId: string, scope: ListScope): Promise<Case>
  startWork(caseId: string, scope: ListScope): Promise<Case>
  // Move a case to Pending Client, tagging why (reason category + message) so the
  // client sees exactly what is needed. This is the one temporary state that
  // legitimately changes case status.
  requestClientInfo(caseId: string, scope: ListScope, reason?: ClientInfoReason, message?: string): Promise<Case>
  // Resolve a case. When resolution details are supplied (from "Mark Resolved"),
  // they are persisted on the case and mirrored into an RCA record.
  resolveCase(
    caseId: string,
    scope: ListScope,
    resolution?: { root_cause: string; resolution_summary: string; solution: string; notes: string },
  ): Promise<Case>
  grantClosure(caseId: string, scope: ListScope): Promise<Case>
  reopenCase(caseId: string, scope: ListScope): Promise<Case>

  // ── Client-driven lifecycle actions (spec: Engineer Change Request, Confirm,
  //    Reopen). These are intentionally allowed for the client role and bypass
  //    the staff close/reopen permissions.
  // Client requests a different engineer; does NOT change case status.
  requestEngineerChange(caseId: string, reason: string, scope: ListScope): Promise<EngineerChangeRequest>
  listEngineerChangeRequests(caseId: string): Promise<EngineerChangeRequest[]>
  // Team Lead / Technical Head approves (reassigns to newEngineerId) or rejects.
  approveEngineerChange(requestId: string, newEngineerId: string, scope: ListScope): Promise<Case>
  rejectEngineerChange(requestId: string, scope: ListScope): Promise<EngineerChangeRequest>
  // Client confirms the solution and submits mandatory feedback → closes the case.
  confirmSolution(caseId: string, feedback: { rating: number; feedback_text: string }, scope: ListScope): Promise<Case>
  // Client reopens a resolved case (with a reason) → back to In Progress.
  clientReopenCase(caseId: string, reason: string, scope: ListScope): Promise<Case>
  // Phase 5: TH approval gate for critical cases
  approveCriticalResolution(caseId: string, scope: ListScope): Promise<Case>
  // Service-based routing: team lead (or escalated Technical Head) accepts a routed case.
  acceptCaseApproval(caseId: string, scope: ListScope): Promise<Case>

  // ── Case claim requests (support engineer "grabs" a new case) ─────────────
  // REST mapping once the backend exists:
  //   listClaimableCases    → GET  /cases/claimable            (SE: unassigned cases routed to my team, approval pending/escalated)
  //   listCaseClaimRequests → GET  /case-claims?case_id=&engineer_id=&status=
  //   requestCaseClaim      → POST /cases/:id/claim            (SE; notifies TL + TH)
  //   resolveCaseClaim      → POST /case-claims/:id/resolve    { decision } (TL/TH; approve assigns the case
  //                            to the requesting engineer and auto-rejects competing pending claims)
  listClaimableCases(scope: ListScope): Promise<Case[]>
  listCaseClaimRequests(filters?: { case_id?: string; engineer_id?: string; status?: CaseClaimRequest['status'] }): Promise<CaseClaimRequest[]>
  requestCaseClaim(caseId: string, scope: ListScope): Promise<CaseClaimRequest>
  resolveCaseClaim(requestId: string, decision: 'approved' | 'rejected', scope: ListScope): Promise<CaseClaimRequest>

  // Sub-cases (child cases with time tracking)
  listSubCases(parentCaseId: string, scope: ListScope): Promise<Case[]>
  createSubCase(parentCaseId: string, input: Partial<Case>, scope: ListScope): Promise<Case>
  // Timer controls (sub-cases). All persist intervals server-side.
  startSubCaseTimer(caseId: string, scope: ListScope): Promise<Case>   // begin first interval
  pauseSubCaseTimer(caseId: string, scope: ListScope): Promise<Case>   // toggle running <-> paused
  endSubCaseTimer(caseId: string, scope: ListScope): Promise<Case>     // permanently stop the timer
  closeSubCase(caseId: string, scope: ListScope): Promise<Case>        // finalize/close the sub-case

  // Case Comments
  listComments(caseId: string, scope: ListScope): Promise<CaseComment[]>
  addComment(input: Omit<CaseComment, 'id' | 'created_at'>, scope: ListScope): Promise<CaseComment>

  // Attachments
  listAttachments(caseId: string): Promise<Attachment[]>
  addAttachment(input: Omit<Attachment, 'id' | 'created_at'>): Promise<Attachment>
  removeAttachment(id: string): Promise<void>

  // RCA
  getRCA(caseId: string): Promise<RCA | null>
  upsertRCA(input: Omit<RCA, 'id' | 'created_at'>): Promise<RCA>

  // KB Articles
  // When scope is provided, the list enforces visibility: published articles for
  // everyone, the requester's own articles in any status, and everything for the
  // reviewer roles (team_lead / technical_head). Without scope the legacy
  // (unfiltered) behaviour is preserved.
  // Search matches title, description, content, tags, category and author name.
  listKBArticles(filters?: KBArticleFilters, scope?: ListScope): Promise<KBArticle[]>
  getKBArticle(id: string): Promise<KBArticle | null>
  createKBArticle(input: Omit<KBArticle, 'id' | 'created_at' | 'updated_at'>): Promise<KBArticle>
  // Content edits snapshot the previous state into `versions` and bump `version`.
  // `actor` stamps who saved (falls back to the article author when omitted).
  updateKBArticle(id: string, patch: Partial<KBArticle>, actor?: ListScope): Promise<KBArticle>
  deleteKBArticle(id: string): Promise<void>
  // ── Review workflow (backend enforces role rules; every transition is
  //    appended to status_history, audited and notified) ─────────────────────
  //   submitKBArticle          → POST /kb/submit              → create + status:'in_review'
  //   submitKBArticleForReview → POST /kb/:id/submit          → draft/changes_requested → in_review (author)
  //   approveKBArticle         → POST /kb/:id/approve         → in_review → approved (TL/TH)
  //   publishKBArticle         → POST /kb/:id/publish         → in_review/approved → published (TL/TH)
  //   rejectKBArticle          → POST /kb/:id/request-changes → in_review/approved → changes_requested + note (TL/TH)
  //   archiveKBArticle         → POST /kb/:id/archive         → published → archived (TL/TH)
  //   restoreKBArticle         → POST /kb/:id/restore         → archived → draft (TH only)
  //   restoreKBVersion         → POST /kb/:id/versions/:v/restore → apply an old snapshot as a new version
  submitKBArticle(input: { title: string; body: string; tags: string[]; author_id: string; author_name?: string; author_role?: Role }): Promise<KBArticle>
  submitKBArticleForReview(id: string, actor: ListScope): Promise<KBArticle>
  approveKBArticle(id: string, actor: ListScope): Promise<KBArticle>
  archiveKBArticle(id: string, actor: ListScope): Promise<KBArticle>
  restoreKBArticle(id: string, actor: ListScope): Promise<KBArticle>
  restoreKBVersion(id: string, version: number, actor: ListScope): Promise<KBArticle>
  publishKBArticle(id: string, actor: ListScope): Promise<KBArticle>
  rejectKBArticle(id: string, actor: ListScope, reason?: string): Promise<KBArticle>
  // KB comments — same dedicated/atomic pattern as solution comments:
  //   addKBComment            → POST   /kb/:id/comments    { author_id, author_name, author_role, body, parent_id }
  //   deleteKBComment         → DELETE /kb/:id/comments/:commentId  (cascades to descendant replies)
  //   toggleKBCommentReaction → POST   /kb/:id/comments/:commentId/reaction { user_id, reaction }
  addKBComment(id: string, input: { author_id: string; author_name: string; author_role?: Role; body: string; parent_id?: string | null }): Promise<KBArticle>
  deleteKBComment(id: string, commentId: string): Promise<KBArticle>
  toggleKBCommentReaction(id: string, commentId: string, userId: string, reaction: 'like' | 'dislike'): Promise<KBArticle>

  // Feedback
  listFeedback(scope: ListScope): Promise<Feedback[]>
  submitFeedback(input: Omit<Feedback, 'id' | 'created_at'>, scope: ListScope): Promise<Feedback>
  updateFeedback(id: string, patch: Partial<Feedback>): Promise<Feedback>

  // Notifications
  listNotifications(userId: string): Promise<Notification[]>
  markNotificationRead(id: string): Promise<void>
  markAllNotificationsRead(userId: string): Promise<void>
  createNotification(input: Omit<Notification, 'id'>): Promise<Notification>

  // Audit Logs
  listAuditLogs(filters?: { entity_type?: string; entity_id?: string; actor_id?: string; limit?: number }): Promise<AuditLog[]>
  writeAuditLog(entry: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog>

  // ── Phase 1: Prospects / Pre-sales ─────────────────────────────────────────
  listProspects(scope: ListScope): Promise<Prospect[]>
  getProspect(id: string): Promise<Prospect | null>
  createProspect(input: Omit<Prospect, 'id' | 'created_at' | 'updated_at'>, scope: ListScope): Promise<Prospect>
  updateProspect(id: string, patch: Partial<Prospect>, scope: ListScope): Promise<Prospect>
  deleteProspect(id: string, scope: ListScope): Promise<void>

  // ── Phase Final: Performance metrics ──────────────────────────────────────
  getEngineerMetrics(engineerId: string, scope: ListScope): Promise<EngineerMetrics>
  listAllEngineerMetrics(scope: ListScope): Promise<EngineerMetrics[]>
  // Target (assigned by Technical Head) + achievement/pipeline, computed from
  // that Sales Executive's own prospects and clients.
  getSalesExecutiveMetrics(salesExecutiveId: string, scope: ListScope): Promise<SalesExecutiveMetrics>

  // ── Phase Final: Notification preferences ─────────────────────────────────
  getUserNotifPrefs(userId: string): Promise<UserNotificationPrefs>
  updateUserNotifPrefs(
    userId: string,
    channels: NotificationChannel[],
    phones?: { sms_phone?: string; whatsapp_phone?: string }
  ): Promise<UserNotificationPrefs>

  // ── Phase Final: Account security ──────────────────────────────────────────
  // Throws if currentPassword doesn't match what's on file for the user.
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>

  // Creates Client + linked User + ClientSolution rows atomically
  createClientAccount(
    input: CreateClientAccountInput,
    scope: ListScope
  ): Promise<{ client: Client; user: User; solutions: ClientSolution[] }>

  // ── Case Transfer Requests ─────────────────────────────────────────────────
  listCaseTransferRequests(teamId: string): Promise<CaseTransferRequest[]>
  listAllPendingCaseTransferRequests(): Promise<CaseTransferRequest[]>
  createCaseTransferRequest(input: Omit<CaseTransferRequest, 'id' | 'created_at'>): Promise<CaseTransferRequest>
  updateCaseTransferRequest(id: string, patch: Partial<CaseTransferRequest>): Promise<CaseTransferRequest>

  // ── Team Member Requests ───────────────────────────────────────────────────
  listTeamMemberRequests(teamId: string): Promise<TeamMemberRequest[]>
  listAllPendingTeamMemberRequests(): Promise<TeamMemberRequest[]>
  createTeamMemberRequest(input: Omit<TeamMemberRequest, 'id' | 'created_at'>): Promise<TeamMemberRequest>
  approveTeamMemberRequest(id: string): Promise<TeamMemberRequest>
  rejectTeamMemberRequest(id: string): Promise<TeamMemberRequest>
}
