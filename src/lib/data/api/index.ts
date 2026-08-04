// TODO: ApiDataProvider — implements DataProvider over real HTTP
// Switch via NEXT_PUBLIC_DATA_SOURCE='api'
// Replace all TODOs with fetch() calls to your REST/GraphQL backend

import type { DataProvider, ListScope, CaseFilters, KBArticleFilters, Paginated, SolutionArticleFilters, CreateSolutionArticleInput, ProjectFilters, EngagementFilters, ClientContactFilters } from '../provider'
import type {
  User, Client, Solution, ClientSolution, Team, Product, ProductLicense, Role,
  SLARule, Case, CaseComment, Attachment, RCA, KBArticle,
  Feedback, Notification, AuditLog,
  Prospect, CreateClientAccountInput,
  EngineerMetrics, SalesExecutiveMetrics, UserNotificationPrefs, NotificationChannel,
  TeamMemberRequest, CaseTransferRequest,
  ClientInfoReason, EngineerChangeRequest, CaseClaimRequest,
  SolutionArticle, Project, ProjectComment, ProjectAttachment, Engagement, ClientContact, ExternalMember,
  PermissionOverride, PermissionAction, PermissionResource,
} from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api'

async function http<T>(path: string, options?: RequestInit): Promise<T> {
  // TODO: add auth headers (Bearer token from session)
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export class ApiDataProvider implements DataProvider {
  async listUsers(): Promise<User[]> { return http('/users') }
  async getUser(id: string): Promise<User | null> { return http(`/users/${id}`) }
  async createUser(input: Omit<User, 'id' | 'created_at'>): Promise<User> { return http('/users', { method: 'POST', body: JSON.stringify(input) }) }
  async updateUser(id: string, patch: Partial<User>): Promise<User> { return http(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) }
  async deleteUser(id: string): Promise<void> { return http(`/users/${id}`, { method: 'DELETE' }) }

  async listPermissionOverrides(userId?: string): Promise<PermissionOverride[]> { return http(`/permission-overrides${userId ? `?user_id=${userId}` : ''}`) }
  async setPermissionOverride(input: { user_id: string; resource: PermissionResource; action: PermissionAction; effect: 'allow' | 'deny'; granted_by: string }): Promise<PermissionOverride> {
    return http('/permission-overrides', { method: 'POST', body: JSON.stringify(input) })
  }
  async removePermissionOverride(id: string): Promise<void> { return http(`/permission-overrides/${id}`, { method: 'DELETE' }) }

  async listClients(_scope: ListScope): Promise<Client[]> { return http('/clients') }
  async getClient(id: string): Promise<Client | null> { return http(`/clients/${id}`) }
  async createClient(input: Omit<Client, 'id' | 'created_at'>): Promise<Client> { return http('/clients', { method: 'POST', body: JSON.stringify(input) }) }
  async updateClient(id: string, patch: Partial<Client>): Promise<Client> { return http(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) }

  async listProjects(_scope: ListScope, filters: ProjectFilters = {}): Promise<Project[]> { return http(`/projects?${new URLSearchParams(filters as Record<string, string>).toString()}`) }
  async getProject(id: string): Promise<Project | null> { return http(`/projects/${id}`) }
  async createProject(input: Omit<Project, 'id' | 'created_at'>): Promise<Project> { return http('/projects', { method: 'POST', body: JSON.stringify(input) }) }
  async updateProject(id: string, patch: Partial<Project>): Promise<Project> { return http(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) }
  async deleteProject(id: string): Promise<void> { return http(`/projects/${id}`, { method: 'DELETE' }) }
  async listProjectComments(projectId: string): Promise<ProjectComment[]> { return http(`/projects/${projectId}/comments`) }
  async addProjectComment(input: Omit<ProjectComment, 'id' | 'created_at'>): Promise<ProjectComment> { return http(`/projects/${input.project_id}/comments`, { method: 'POST', body: JSON.stringify(input) }) }
  async listProjectAttachments(projectId: string): Promise<ProjectAttachment[]> { return http(`/projects/${projectId}/attachments`) }
  async addProjectAttachment(input: Omit<ProjectAttachment, 'id' | 'created_at'>): Promise<ProjectAttachment> { return http(`/projects/${input.project_id}/attachments`, { method: 'POST', body: JSON.stringify(input) }) }
  async listSubProjects(parentProjectId: string): Promise<Project[]> { return http(`/projects/${parentProjectId}/sub-projects`) }
  async createSubProject(parentProjectId: string, input: Partial<Project>): Promise<Project> { return http(`/projects/${parentProjectId}/sub-projects`, { method: 'POST', body: JSON.stringify(input) }) }

  async listExternalMembers(filters: { case_id?: string; project_id?: string }): Promise<ExternalMember[]> { return http(`/external-members?${new URLSearchParams(filters as Record<string, string>).toString()}`) }
  async addExternalMember(input: Omit<ExternalMember, 'id' | 'created_at'>): Promise<ExternalMember> { return http('/external-members', { method: 'POST', body: JSON.stringify(input) }) }
  async deleteExternalMember(id: string): Promise<void> { return http(`/external-members/${id}`, { method: 'DELETE' }) }

  async listEngagements(_scope: ListScope, filters: EngagementFilters = {}): Promise<Engagement[]> { return http(`/engagements?${new URLSearchParams(filters as Record<string, string>).toString()}`) }
  async getEngagement(id: string): Promise<Engagement | null> { return http(`/engagements/${id}`) }
  async createEngagement(input: Omit<Engagement, 'id' | 'created_at'>): Promise<Engagement> { return http('/engagements', { method: 'POST', body: JSON.stringify(input) }) }
  async updateEngagement(id: string, patch: Partial<Engagement>): Promise<Engagement> { return http(`/engagements/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) }
  async deleteEngagement(id: string): Promise<void> { return http(`/engagements/${id}`, { method: 'DELETE' }) }
  async assignEngagementProductLine(engagementId: string, lineId: string, input: { team_id?: string; handler_ids?: string[] }, _scope: ListScope): Promise<Engagement> {
    return http(`/engagements/${engagementId}/products/${lineId}/assign`, { method: 'POST', body: JSON.stringify(input) })
  }
  async setEngagementLinePocOutcome(engagementId: string, lineId: string, outcome: 'running' | 'success' | 'failed', _scope: ListScope): Promise<Engagement> {
    return http(`/engagements/${engagementId}/products/${lineId}/poc-outcome`, { method: 'POST', body: JSON.stringify({ outcome }) })
  }

  async listClientContacts(filters: ClientContactFilters = {}): Promise<ClientContact[]> { return http(`/client-contacts?${new URLSearchParams(filters as Record<string, string>).toString()}`) }
  async createClientContact(input: Omit<ClientContact, 'id' | 'created_at'>): Promise<ClientContact> { return http('/client-contacts', { method: 'POST', body: JSON.stringify(input) }) }

  async listSolutions(): Promise<Solution[]> { return http('/solutions') }
  async getSolution(id: string): Promise<Solution | null> { return http(`/solutions/${id}`) }
  async createSolution(input: Omit<Solution, 'id' | 'created_at'>): Promise<Solution> { return http('/solutions', { method: 'POST', body: JSON.stringify(input) }) }
  async updateSolution(id: string, patch: Partial<Solution>): Promise<Solution> { return http(`/solutions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) }
  async deleteSolution(id: string): Promise<void> { return http(`/solutions/${id}`, { method: 'DELETE' }) }
  async toggleSolutionLike(id: string, userId: string): Promise<Solution> { return http(`/solutions/${id}/like`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }) }
  async toggleSolutionDislike(id: string, userId: string): Promise<Solution> { return http(`/solutions/${id}/dislike`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }) }
  async addSolutionComment(id: string, input: { author_id: string; author_name: string; author_role?: Role; body: string; parent_id?: string | null }): Promise<Solution> { return http(`/solutions/${id}/comments`, { method: 'POST', body: JSON.stringify(input) }) }
  async deleteSolutionComment(id: string, commentId: string): Promise<Solution> { return http(`/solutions/${id}/comments/${commentId}`, { method: 'DELETE' }) }
  async toggleSolutionCommentReaction(id: string, commentId: string, userId: string, reaction: 'like' | 'dislike'): Promise<Solution> { return http(`/solutions/${id}/comments/${commentId}/reaction`, { method: 'POST', body: JSON.stringify({ user_id: userId, reaction }) }) }

  // Solution Articles — backend stores markdown only and owns slug uniqueness.
  async listSolutionArticles(filters: SolutionArticleFilters = {}): Promise<SolutionArticle[]> { return http(`/solution-articles?${new URLSearchParams(filters as Record<string, string>).toString()}`) }
  async getSolutionArticle(id: string): Promise<SolutionArticle | null> { return http(`/solution-articles/${id}`) }
  async getSolutionArticleBySlug(slug: string): Promise<SolutionArticle | null> { return http(`/solution-articles/slug/${encodeURIComponent(slug)}`) }
  async createSolutionArticle(input: CreateSolutionArticleInput): Promise<SolutionArticle> { return http('/solution-articles', { method: 'POST', body: JSON.stringify(input) }) }
  async updateSolutionArticle(id: string, patch: Partial<SolutionArticle>): Promise<SolutionArticle> { return http(`/solution-articles/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) }
  async deleteSolutionArticle(id: string): Promise<void> { return http(`/solution-articles/${id}`, { method: 'DELETE' }) }
  async toggleSolutionArticleLike(id: string, userId: string): Promise<SolutionArticle> { return http(`/solution-articles/${id}/like`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }) }
  async toggleSolutionArticleDislike(id: string, userId: string): Promise<SolutionArticle> { return http(`/solution-articles/${id}/dislike`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }) }
  async addSolutionArticleComment(id: string, input: { author_id: string; author_name: string; author_role?: Role; body: string; parent_id?: string | null }): Promise<SolutionArticle> { return http(`/solution-articles/${id}/comments`, { method: 'POST', body: JSON.stringify(input) }) }
  async deleteSolutionArticleComment(id: string, commentId: string): Promise<SolutionArticle> { return http(`/solution-articles/${id}/comments/${commentId}`, { method: 'DELETE' }) }
  async toggleSolutionArticleCommentReaction(id: string, commentId: string, userId: string, reaction: 'like' | 'dislike'): Promise<SolutionArticle> { return http(`/solution-articles/${id}/comments/${commentId}/reaction`, { method: 'POST', body: JSON.stringify({ user_id: userId, reaction }) }) }

  async listClientSolutions(clientId?: string): Promise<ClientSolution[]> { return http(`/client-solutions${clientId ? `?client_id=${clientId}` : ''}`) }
  async addClientSolution(clientId: string, solutionId: string): Promise<ClientSolution> { return http('/client-solutions', { method: 'POST', body: JSON.stringify({ client_id: clientId, solution_id: solutionId }) }) }
  async removeClientSolution(id: string): Promise<void> { return http(`/client-solutions/${id}`, { method: 'DELETE' }) }

  async listTeams(): Promise<Team[]> { return http('/teams') }
  async getTeam(id: string): Promise<Team | null> { return http(`/teams/${id}`) }
  async createTeam(input: Omit<Team, 'id' | 'created_at'>): Promise<Team> { return http('/teams', { method: 'POST', body: JSON.stringify(input) }) }
  async updateTeam(id: string, patch: Partial<Team>): Promise<Team> { return http(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) }

  async listProducts(): Promise<Product[]> { return http('/products') }
  async listProductLicenses(): Promise<ProductLicense[]> { return http('/product-licenses') }
  async getProduct(id: string): Promise<Product | null> { return http(`/products/${id}`) }
  async createProduct(input: Omit<Product, 'id' | 'created_at'>): Promise<Product> { return http('/products', { method: 'POST', body: JSON.stringify(input) }) }
  async updateProduct(id: string, patch: Partial<Product>): Promise<Product> { return http(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) }

  async listSLARules(): Promise<SLARule[]> { return http('/sla-rules') }
  async getSLARule(id: string): Promise<SLARule | null> { return http(`/sla-rules/${id}`) }
  async upsertSLARule(rule: SLARule): Promise<SLARule> { return http(`/sla-rules/${rule.id}`, { method: 'PUT', body: JSON.stringify(rule) }) }

  async listCases(_scope: ListScope, filters: CaseFilters = {}): Promise<Paginated<Case>> { return http(`/cases?${new URLSearchParams(filters as Record<string, string>).toString()}`) }
  async getCase(id: string, _scope: ListScope): Promise<Case | null> { return http(`/cases/${id}`) }
  async createCase(input: Omit<Case, 'id' | 'reference_no' | 'created_at'>, _scope: ListScope): Promise<Case> { return http('/cases', { method: 'POST', body: JSON.stringify(input) }) }
  async updateCase(id: string, patch: Partial<Case>, _scope: ListScope): Promise<Case> { return http(`/cases/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) }
  async assignCase(caseId: string, assigneeId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/assign`, { method: 'POST', body: JSON.stringify({ assignee_id: assigneeId }) }) }
  async claimCase(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/claim`, { method: 'POST' }) }
  async escalateCase(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/escalate`, { method: 'POST' }) }
  async startWork(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/start`, { method: 'POST' }) }
  async requestClientInfo(caseId: string, _scope: ListScope, reason?: ClientInfoReason, message?: string): Promise<Case> { return http(`/cases/${caseId}/pending-client`, { method: 'POST', body: JSON.stringify({ reason, message }) }) }
  async resolveCase(caseId: string, _scope: ListScope, resolution?: { root_cause: string; resolution_summary: string; solution: string; notes: string }): Promise<Case> { return http(`/cases/${caseId}/resolve`, { method: 'POST', body: JSON.stringify(resolution ?? {}) }) }
  async grantClosure(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/close`, { method: 'POST' }) }
  async reopenCase(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/reopen`, { method: 'POST' }) }
  async requestEngineerChange(caseId: string, reason: string, _scope: ListScope): Promise<EngineerChangeRequest> { return http(`/cases/${caseId}/engineer-change`, { method: 'POST', body: JSON.stringify({ reason }) }) }
  async listEngineerChangeRequests(caseId: string): Promise<EngineerChangeRequest[]> { return http(`/cases/${caseId}/engineer-change`) }
  async approveEngineerChange(requestId: string, newEngineerId: string, _scope: ListScope): Promise<Case> { return http(`/engineer-change/${requestId}/approve`, { method: 'POST', body: JSON.stringify({ new_engineer_id: newEngineerId }) }) }
  async rejectEngineerChange(requestId: string, _scope: ListScope): Promise<EngineerChangeRequest> { return http(`/engineer-change/${requestId}/reject`, { method: 'POST' }) }
  async confirmSolution(caseId: string, feedback: { rating: number; feedback_text: string; question_ratings?: Record<string, number> }, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/confirm`, { method: 'POST', body: JSON.stringify(feedback) }) }
  async clientReopenCase(caseId: string, reason: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/client-reopen`, { method: 'POST', body: JSON.stringify({ reason }) }) }
  async approveCriticalResolution(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/approve`, { method: 'POST' }) }
  // Backend resolves the team by service match, creates the pending approval + 30-min deadline,
  // and runs the time-based escalation to the Technical Head server-side (e.g. a scheduled job).
  async acceptCaseApproval(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/accept-approval`, { method: 'POST' }) }

  // Case claim requests — backend enforces: SE-only create, TL/TH-only resolve;
  // approving assigns the case to the requesting engineer, settles the routing
  // approval, and auto-rejects competing pending claims.
  async listClaimableCases(_scope: ListScope): Promise<Case[]> { return http('/cases/claimable') }
  async listCaseClaimRequests(filters: { case_id?: string; engineer_id?: string; status?: CaseClaimRequest['status'] } = {}): Promise<CaseClaimRequest[]> { return http(`/case-claims?${new URLSearchParams(filters as Record<string, string>).toString()}`) }
  async requestCaseClaim(caseId: string, _scope: ListScope): Promise<CaseClaimRequest> { return http(`/cases/${caseId}/claim`, { method: 'POST' }) }
  async resolveCaseClaim(requestId: string, decision: 'approved' | 'rejected', _scope: ListScope): Promise<CaseClaimRequest> { return http(`/case-claims/${requestId}/resolve`, { method: 'POST', body: JSON.stringify({ decision }) }) }

  // Sub-cases — backend must enforce that only support_engineer/team_lead/technical_head can create.
  async listSubCases(parentCaseId: string, _scope: ListScope): Promise<Case[]> { return http(`/cases/${parentCaseId}/sub-cases`) }
  async createSubCase(parentCaseId: string, input: Partial<Case>, _scope: ListScope): Promise<Case> { return http(`/cases/${parentCaseId}/sub-cases`, { method: 'POST', body: JSON.stringify(input) }) }
  async startSubCaseTimer(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/timer/start`, { method: 'POST' }) }
  async pauseSubCaseTimer(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/timer/pause`, { method: 'POST' }) }
  async endSubCaseTimer(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/timer/end`, { method: 'POST' }) }
  async closeSubCase(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/close-subtask`, { method: 'POST' }) }

  async listComments(caseId: string, _scope: ListScope): Promise<CaseComment[]> { return http(`/cases/${caseId}/comments`) }
  async addComment(input: Omit<CaseComment, 'id' | 'created_at'>, _scope: ListScope): Promise<CaseComment> { return http(`/cases/${input.case_id}/comments`, { method: 'POST', body: JSON.stringify(input) }) }
  async listRecentComments(_scope: ListScope): Promise<CaseComment[]> { return http('/comments/recent') }

  async listAttachments(caseId: string): Promise<Attachment[]> { return http(`/cases/${caseId}/attachments`) }
  async addAttachment(input: Omit<Attachment, 'id' | 'created_at'>): Promise<Attachment> { return http(`/cases/${input.case_id}/attachments`, { method: 'POST', body: JSON.stringify(input) }) }
  async removeAttachment(id: string): Promise<void> { await http(`/attachments/${id}`, { method: 'DELETE' }) }

  async getRCA(caseId: string): Promise<RCA | null> { return http(`/cases/${caseId}/rca`) }
  async upsertRCA(input: Omit<RCA, 'id' | 'created_at'>): Promise<RCA> { return http(`/cases/${input.case_id}/rca`, { method: 'PUT', body: JSON.stringify(input) }) }

  async listKBArticles(filters: KBArticleFilters = {}, _scope?: ListScope): Promise<KBArticle[]> { return http(`/kb?${new URLSearchParams(filters as Record<string, string>).toString()}`) }
  async getKBArticle(id: string): Promise<KBArticle | null> { return http(`/kb/${id}`) }
  async createKBArticle(input: Omit<KBArticle, 'id' | 'created_at' | 'updated_at'>): Promise<KBArticle> { return http('/kb', { method: 'POST', body: JSON.stringify(input) }) }
  async updateKBArticle(id: string, patch: Partial<KBArticle>, _actor?: ListScope): Promise<KBArticle> { return http(`/kb/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) }
  async deleteKBArticle(id: string): Promise<void> { return http(`/kb/${id}`, { method: 'DELETE' }) }
  async submitKBArticle(input: { title: string; body: string; tags: string[]; author_id: string; author_name?: string; author_role?: Role }): Promise<KBArticle> { return http('/kb/submit', { method: 'POST', body: JSON.stringify(input) }) }
  async submitKBArticleForReview(id: string, _actor: ListScope): Promise<KBArticle> { return http(`/kb/${id}/submit`, { method: 'POST' }) }
  async approveKBArticle(id: string, _actor: ListScope): Promise<KBArticle> { return http(`/kb/${id}/approve`, { method: 'POST' }) }
  async publishKBArticle(id: string, _actor: ListScope): Promise<KBArticle> { return http(`/kb/${id}/publish`, { method: 'POST' }) }
  async rejectKBArticle(id: string, _actor: ListScope, reason?: string): Promise<KBArticle> { return http(`/kb/${id}/request-changes`, { method: 'POST', body: JSON.stringify({ reason }) }) }
  async archiveKBArticle(id: string, _actor: ListScope): Promise<KBArticle> { return http(`/kb/${id}/archive`, { method: 'POST' }) }
  async restoreKBArticle(id: string, _actor: ListScope): Promise<KBArticle> { return http(`/kb/${id}/restore`, { method: 'POST' }) }
  async restoreKBVersion(id: string, version: number, _actor: ListScope): Promise<KBArticle> { return http(`/kb/${id}/versions/${version}/restore`, { method: 'POST' }) }
  async addKBComment(id: string, input: { author_id: string; author_name: string; author_role?: Role; body: string; parent_id?: string | null }): Promise<KBArticle> { return http(`/kb/${id}/comments`, { method: 'POST', body: JSON.stringify(input) }) }
  async deleteKBComment(id: string, commentId: string): Promise<KBArticle> { return http(`/kb/${id}/comments/${commentId}`, { method: 'DELETE' }) }
  async toggleKBCommentReaction(id: string, commentId: string, userId: string, reaction: 'like' | 'dislike'): Promise<KBArticle> { return http(`/kb/${id}/comments/${commentId}/reaction`, { method: 'POST', body: JSON.stringify({ user_id: userId, reaction }) }) }

  async listFeedback(_scope: ListScope): Promise<Feedback[]> { return http('/feedback') }
  async submitFeedback(input: Omit<Feedback, 'id' | 'created_at'>, _scope: ListScope): Promise<Feedback> { return http('/feedback', { method: 'POST', body: JSON.stringify(input) }) }
  async updateFeedback(id: string, patch: Partial<Feedback>): Promise<Feedback> { return http(`/feedback/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) }

  async listNotifications(userId: string): Promise<Notification[]> { return http(`/notifications?user_id=${userId}`) }
  async markNotificationRead(id: string): Promise<void> { return http(`/notifications/${id}/read`, { method: 'POST' }) }
  async markAllNotificationsRead(userId: string): Promise<void> { return http(`/notifications/read-all?user_id=${userId}`, { method: 'POST' }) }
  async createNotification(input: Omit<Notification, 'id'>): Promise<Notification> { return http('/notifications', { method: 'POST', body: JSON.stringify(input) }) }

  async listAuditLogs(filters: { entity_type?: string; entity_id?: string; actor_id?: string; limit?: number } = {}): Promise<AuditLog[]> { return http(`/audit-logs?${new URLSearchParams(filters as Record<string, string>).toString()}`) }
  async writeAuditLog(entry: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> { return http('/audit-logs', { method: 'POST', body: JSON.stringify(entry) }) }

  // ── Phase 1: Prospects ─────────────────────────────────────────────────────
  async listProspects(_scope: ListScope): Promise<Prospect[]> { return http('/prospects') }
  async getProspect(id: string): Promise<Prospect | null> { return http(`/prospects/${id}`) }
  async createProspect(input: Omit<Prospect, 'id' | 'created_at' | 'updated_at'>, _scope: ListScope): Promise<Prospect> { return http('/prospects', { method: 'POST', body: JSON.stringify(input) }) }
  async updateProspect(id: string, patch: Partial<Prospect>, _scope: ListScope): Promise<Prospect> { return http(`/prospects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) }
  async deleteProspect(id: string, _scope: ListScope): Promise<void> { return http(`/prospects/${id}`, { method: 'DELETE' }) }
  async createClientAccount(input: CreateClientAccountInput, _scope: ListScope): Promise<{ client: Client; user: User; solutions: ClientSolution[] }> { return http('/clients/accounts', { method: 'POST', body: JSON.stringify(input) }) }

  async getEngineerMetrics(engineerId: string, _scope: ListScope): Promise<EngineerMetrics> { return http(`/engineers/${engineerId}/metrics`) }
  async listAllEngineerMetrics(_scope: ListScope): Promise<EngineerMetrics[]> { return http('/engineers/metrics') }

  async getSalesExecutiveMetrics(salesExecutiveId: string, _scope: ListScope): Promise<SalesExecutiveMetrics> { return http(`/sales-executives/${salesExecutiveId}/metrics`) }

  async getUserNotifPrefs(userId: string): Promise<UserNotificationPrefs> { return http(`/users/${userId}/notif-prefs`) }
  async updateUserNotifPrefs(userId: string, channels: NotificationChannel[]): Promise<UserNotificationPrefs> { return http(`/users/${userId}/notif-prefs`, { method: 'PUT', body: JSON.stringify({ channels }) }) }

  async listCaseTransferRequests(teamId: string): Promise<CaseTransferRequest[]> { return http(`/teams/${teamId}/case-transfer-requests`) }
  async listAllPendingCaseTransferRequests(): Promise<CaseTransferRequest[]> { return http('/case-transfer-requests?status=pending') }
  async createCaseTransferRequest(input: Omit<CaseTransferRequest, 'id' | 'created_at'>): Promise<CaseTransferRequest> { return http(`/teams/${input.team_id}/case-transfer-requests`, { method: 'POST', body: JSON.stringify(input) }) }
  async updateCaseTransferRequest(id: string, patch: Partial<CaseTransferRequest>): Promise<CaseTransferRequest> { return http(`/case-transfer-requests/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) }

  async listTeamMemberRequests(teamId: string): Promise<TeamMemberRequest[]> { return http(`/teams/${teamId}/member-requests`) }
  async listAllPendingTeamMemberRequests(): Promise<TeamMemberRequest[]> { return http('/team-member-requests?status=pending') }
  async createTeamMemberRequest(input: Omit<TeamMemberRequest, 'id' | 'created_at'>): Promise<TeamMemberRequest> { return http(`/teams/${input.team_id}/member-requests`, { method: 'POST', body: JSON.stringify(input) }) }
  async approveTeamMemberRequest(id: string): Promise<TeamMemberRequest> { return http(`/team-member-requests/${id}/approve`, { method: 'POST' }) }
  async rejectTeamMemberRequest(id: string): Promise<TeamMemberRequest> { return http(`/team-member-requests/${id}/reject`, { method: 'POST' }) }
}

export const apiDataProvider = new ApiDataProvider()