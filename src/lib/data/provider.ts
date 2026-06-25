import type {
  User, Client, Solution, ClientSolution, Team, Product,
  SLARule, Case, CaseComment, Attachment, RCA, KBArticle,
  Feedback, Notification, AuditLog, Role,
  Prospect, CreateClientAccountInput,
  EngineerMetrics, UserNotificationPrefs, NotificationChannel,
  TeamMemberRequest, CaseTransferRequest,
} from '@/types'

export interface ListScope {
  userId: string
  role: Role
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
  requestClientInfo(caseId: string, scope: ListScope): Promise<Case>
  resolveCase(caseId: string, scope: ListScope): Promise<Case>
  grantClosure(caseId: string, scope: ListScope): Promise<Case>
  reopenCase(caseId: string, scope: ListScope): Promise<Case>
  // Phase 5: TH approval gate for critical cases
  approveCriticalResolution(caseId: string, scope: ListScope): Promise<Case>

  // Case Comments
  listComments(caseId: string, scope: ListScope): Promise<CaseComment[]>
  addComment(input: Omit<CaseComment, 'id' | 'created_at'>, scope: ListScope): Promise<CaseComment>

  // Attachments
  listAttachments(caseId: string): Promise<Attachment[]>
  addAttachment(input: Omit<Attachment, 'id' | 'created_at'>): Promise<Attachment>

  // RCA
  getRCA(caseId: string): Promise<RCA | null>
  upsertRCA(input: Omit<RCA, 'id' | 'created_at'>): Promise<RCA>

  // KB Articles
  listKBArticles(filters?: { status?: string; search?: string }): Promise<KBArticle[]>
  getKBArticle(id: string): Promise<KBArticle | null>
  createKBArticle(input: Omit<KBArticle, 'id' | 'created_at' | 'updated_at'>): Promise<KBArticle>
  updateKBArticle(id: string, patch: Partial<KBArticle>): Promise<KBArticle>

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

  // ── Phase Final: Notification preferences ─────────────────────────────────
  getUserNotifPrefs(userId: string): Promise<UserNotificationPrefs>
  updateUserNotifPrefs(userId: string, channels: NotificationChannel[]): Promise<UserNotificationPrefs>

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
