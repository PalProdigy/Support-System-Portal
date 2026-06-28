// TODO: ApiDataProvider — implements DataProvider over real HTTP
// Switch via NEXT_PUBLIC_DATA_SOURCE='api'
// Replace all TODOs with fetch() calls to your REST/GraphQL backend

import type { DataProvider, ListScope, CaseFilters, Paginated } from '../provider'
import type {
  User, Client, Solution, ClientSolution, Team, Product,
  SLARule, Case, CaseComment, Attachment, RCA, KBArticle,
  Feedback, Notification, AuditLog,
  Prospect, CreateClientAccountInput,
  EngineerMetrics, UserNotificationPrefs, NotificationChannel,
  TeamMemberRequest, CaseTransferRequest,
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

  async listClients(_scope: ListScope): Promise<Client[]> { return http('/clients') }
  async getClient(id: string): Promise<Client | null> { return http(`/clients/${id}`) }
  async createClient(input: Omit<Client, 'id' | 'created_at'>): Promise<Client> { return http('/clients', { method: 'POST', body: JSON.stringify(input) }) }
  async updateClient(id: string, patch: Partial<Client>): Promise<Client> { return http(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) }

  async listSolutions(): Promise<Solution[]> { return http('/solutions') }
  async getSolution(id: string): Promise<Solution | null> { return http(`/solutions/${id}`) }
  async createSolution(input: Omit<Solution, 'id' | 'created_at'>): Promise<Solution> { return http('/solutions', { method: 'POST', body: JSON.stringify(input) }) }
  async updateSolution(id: string, patch: Partial<Solution>): Promise<Solution> { return http(`/solutions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) }
  async deleteSolution(id: string): Promise<void> { return http(`/solutions/${id}`, { method: 'DELETE' }) }

  async listClientSolutions(clientId?: string): Promise<ClientSolution[]> { return http(`/client-solutions${clientId ? `?client_id=${clientId}` : ''}`) }
  async addClientSolution(clientId: string, solutionId: string): Promise<ClientSolution> { return http('/client-solutions', { method: 'POST', body: JSON.stringify({ client_id: clientId, solution_id: solutionId }) }) }
  async removeClientSolution(id: string): Promise<void> { return http(`/client-solutions/${id}`, { method: 'DELETE' }) }

  async listTeams(): Promise<Team[]> { return http('/teams') }
  async getTeam(id: string): Promise<Team | null> { return http(`/teams/${id}`) }
  async createTeam(input: Omit<Team, 'id' | 'created_at'>): Promise<Team> { return http('/teams', { method: 'POST', body: JSON.stringify(input) }) }
  async updateTeam(id: string, patch: Partial<Team>): Promise<Team> { return http(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) }

  async listProducts(): Promise<Product[]> { return http('/products') }
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
  async escalateCase(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/escalate`, { method: 'POST' }) }
  async startWork(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/start`, { method: 'POST' }) }
  async requestClientInfo(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/pending-client`, { method: 'POST' }) }
  async resolveCase(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/resolve`, { method: 'POST' }) }
  async grantClosure(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/close`, { method: 'POST' }) }
  async reopenCase(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/reopen`, { method: 'POST' }) }
  async approveCriticalResolution(caseId: string, _scope: ListScope): Promise<Case> { return http(`/cases/${caseId}/approve`, { method: 'POST' }) }

  async listComments(caseId: string, _scope: ListScope): Promise<CaseComment[]> { return http(`/cases/${caseId}/comments`) }
  async addComment(input: Omit<CaseComment, 'id' | 'created_at'>, _scope: ListScope): Promise<CaseComment> { return http(`/cases/${input.case_id}/comments`, { method: 'POST', body: JSON.stringify(input) }) }

  async listAttachments(caseId: string): Promise<Attachment[]> { return http(`/cases/${caseId}/attachments`) }
  async addAttachment(input: Omit<Attachment, 'id' | 'created_at'>): Promise<Attachment> { return http(`/cases/${input.case_id}/attachments`, { method: 'POST', body: JSON.stringify(input) }) }

  async getRCA(caseId: string): Promise<RCA | null> { return http(`/cases/${caseId}/rca`) }
  async upsertRCA(input: Omit<RCA, 'id' | 'created_at'>): Promise<RCA> { return http(`/cases/${input.case_id}/rca`, { method: 'PUT', body: JSON.stringify(input) }) }

  async listKBArticles(filters: { status?: string; search?: string } = {}): Promise<KBArticle[]> { return http(`/kb?${new URLSearchParams(filters as Record<string, string>).toString()}`) }
  async getKBArticle(id: string): Promise<KBArticle | null> { return http(`/kb/${id}`) }
  async createKBArticle(input: Omit<KBArticle, 'id' | 'created_at' | 'updated_at'>): Promise<KBArticle> { return http('/kb', { method: 'POST', body: JSON.stringify(input) }) }
  async updateKBArticle(id: string, patch: Partial<KBArticle>): Promise<KBArticle> { return http(`/kb/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }) }

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