'use client'

import type { DataProvider, ListScope, CaseFilters, Paginated } from '../provider'
import type {
  User, Client, Solution, SolutionComment, ThreadComment, ClientSolution, Team, Product, Role,
  SLARule, Case, CaseComment, Attachment, RCA, KBArticle,
  Feedback, Notification, AuditLog,
  Prospect, CreateClientAccountInput,
  EngineerMetrics, UserNotificationPrefs, NotificationChannel,
  TeamMemberRequest, CaseTransferRequest,
  ClientInfoReason, EngineerChangeRequest,
} from '@/types'
import { canAccess, requireAccess, canCreateSubCase } from '@/lib/rbac'
import { CLIENT_INFO_REASON_LABELS } from '@/lib/utils'
import { dispatchToChannels } from '@/lib/notifications/dispatcher'
import { ALL_ADAPTERS } from '@/lib/notifications/adapters'

// Seed imports
import seedUsers from '@/data/seed/users.json'
import seedTeams from '@/data/seed/teams.json'
import seedSolutions from '@/data/seed/solutions.json'
import seedProducts from '@/data/seed/products.json'
import seedClients from '@/data/seed/clients.json'
import seedClientSolutions from '@/data/seed/client_solutions.json'
import seedSLARules from '@/data/seed/sla_rules.json'
import seedCases from '@/data/seed/cases.json'
import seedComments from '@/data/seed/case_comments.json'
import seedKBArticles from '@/data/seed/kb_articles.json'
import seedFeedback from '@/data/seed/feedback.json'
import seedNotifications from '@/data/seed/notifications.json'
import seedAuditLogs from '@/data/seed/audit_logs.json'
import seedProspects from '@/data/seed/prospects.json'

const STORAGE_KEYS = {
  users: 'nhq_users',
  clients: 'nhq_clients',
  solutions: 'nhq_solutions',
  clientSolutions: 'nhq_client_solutions',
  teams: 'nhq_teams',
  products: 'nhq_products',
  slaRules: 'nhq_sla_rules',
  cases: 'nhq_cases',
  comments: 'nhq_comments',
  attachments: 'nhq_attachments',
  rcas: 'nhq_rcas',
  kbArticles: 'nhq_kb_articles',
  feedback: 'nhq_feedback',
  notifications: 'nhq_notifications',
  auditLogs: 'nhq_audit_logs',
  prospects: 'nhq_prospects',
  slaEvents: 'nhq_sla_events',
  notifPrefs: 'nhq_notif_prefs',
  teamMemberRequests: 'nhq_team_member_requests',
  caseTransferRequests: 'nhq_case_transfer_requests',
  engineerChangeRequests: 'nhq_engineer_change_requests',
  seeded: 'nhq_seeded',
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function now(): string {
  return new Date().toISOString()
}

// Team-lead approval window: if the lead doesn't accept within this time, the
// pending approval escalates to the Technical Head.
const APPROVAL_WINDOW_MS = 30 * 60 * 1000 // 30 minutes

function load<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function save<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(data))
}

const SEED_VERSION = '11' // bump when seed schema changes

function ensureSeeded(): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(STORAGE_KEYS.seeded) === SEED_VERSION) return
  // Clear stale seed data before re-seeding
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k))

  save(STORAGE_KEYS.users, seedUsers)
  save(STORAGE_KEYS.teams, seedTeams)
  save(STORAGE_KEYS.solutions, seedSolutions)
  save(STORAGE_KEYS.products, seedProducts)
  save(STORAGE_KEYS.clients, seedClients)
  save(STORAGE_KEYS.clientSolutions, seedClientSolutions)
  save(STORAGE_KEYS.slaRules, seedSLARules)
  save(STORAGE_KEYS.cases, seedCases)
  save(STORAGE_KEYS.comments, seedComments)
  save(STORAGE_KEYS.attachments, [])
  save(STORAGE_KEYS.rcas, [])
  save(STORAGE_KEYS.kbArticles, seedKBArticles)
  save(STORAGE_KEYS.feedback, seedFeedback)
  save(STORAGE_KEYS.notifications, seedNotifications)
  save(STORAGE_KEYS.auditLogs, seedAuditLogs)
  save(STORAGE_KEYS.prospects, seedProspects)
  localStorage.setItem(STORAGE_KEYS.seeded, SEED_VERSION)
}

function delay<T>(val: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(val), 50))
}

class MockDataProvider implements DataProvider {
  constructor() {
    ensureSeeded()
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  async listUsers(): Promise<User[]> {
    return delay(load<User>(STORAGE_KEYS.users))
  }

  async getUser(id: string): Promise<User | null> {
    return delay(load<User>(STORAGE_KEYS.users).find((u) => u.id === id) ?? null)
  }

  async createUser(input: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const users = load<User>(STORAGE_KEYS.users)
    const user: User = { ...input, id: genId(), created_at: now() }
    save(STORAGE_KEYS.users, [...users, user])
    return delay(user)
  }

  async updateUser(id: string, patch: Partial<User>): Promise<User> {
    const users = load<User>(STORAGE_KEYS.users)
    const idx = users.findIndex((u) => u.id === id)
    if (idx === -1) throw new Error(`User ${id} not found`)
    users[idx] = { ...users[idx], ...patch }
    save(STORAGE_KEYS.users, users)
    return delay(users[idx])
  }

  async deleteUser(id: string): Promise<void> {
    const users = load<User>(STORAGE_KEYS.users).filter((u) => u.id !== id)
    save(STORAGE_KEYS.users, users)
    return delay(undefined)
  }

  // ── Clients ────────────────────────────────────────────────────────────────
  async listClients(scope: ListScope): Promise<Client[]> {
    let clients = load<Client>(STORAGE_KEYS.clients)
    if (scope.role === 'client') {
      const users = load<User>(STORAGE_KEYS.users)
      const user = users.find((u) => u.id === scope.userId)
      if (user) clients = clients.filter((c) => c.user_id === user.id)
    } else if (scope.role === 'sales_executive') {
      clients = clients.filter((c) => c.created_by === scope.userId)
    } else if (scope.role === 'team_lead') {
      const user = load<User>(STORAGE_KEYS.users).find((u) => u.id === scope.userId)
      if (user?.team_id) {
        const teamClientIds = new Set(
          load<Case>(STORAGE_KEYS.cases)
            .filter((c) => c.team_id === user.team_id)
            .map((c) => c.client_id)
        )
        clients = clients.filter((c) => teamClientIds.has(c.id))
      } else {
        clients = []
      }
    } else if (scope.role === 'support_engineer') {
      const assignedClientIds = new Set(
        load<Case>(STORAGE_KEYS.cases)
          .filter((c) => c.assignee_id === scope.userId)
          .map((c) => c.client_id)
      )
      clients = clients.filter((c) => assignedClientIds.has(c.id))
    }
    // technical_head: no filter — sees all clients
    return delay(clients)
  }

  async getClient(id: string): Promise<Client | null> {
    return delay(load<Client>(STORAGE_KEYS.clients).find((c) => c.id === id) ?? null)
  }

  async createClient(input: Omit<Client, 'id' | 'created_at'>): Promise<Client> {
    const clients = load<Client>(STORAGE_KEYS.clients)
    const client: Client = { ...input, id: genId(), created_at: now() }
    save(STORAGE_KEYS.clients, [...clients, client])
    return delay(client)
  }

  async updateClient(id: string, patch: Partial<Client>): Promise<Client> {
    const clients = load<Client>(STORAGE_KEYS.clients)
    const idx = clients.findIndex((c) => c.id === id)
    if (idx === -1) throw new Error(`Client ${id} not found`)
    clients[idx] = { ...clients[idx], ...patch }
    save(STORAGE_KEYS.clients, clients)
    return delay(clients[idx])
  }

  // ── Solutions ──────────────────────────────────────────────────────────────
  async listSolutions(): Promise<Solution[]> {
    return delay(load<Solution>(STORAGE_KEYS.solutions))
  }

  async getSolution(id: string): Promise<Solution | null> {
    return delay(load<Solution>(STORAGE_KEYS.solutions).find((s) => s.id === id) ?? null)
  }

  async createSolution(input: Omit<Solution, 'id' | 'created_at'>): Promise<Solution> {
    const solutions = load<Solution>(STORAGE_KEYS.solutions)
    const solution: Solution = { ...input, id: genId(), created_at: now() }
    save(STORAGE_KEYS.solutions, [...solutions, solution])
    return delay(solution)
  }

  async updateSolution(id: string, patch: Partial<Solution>): Promise<Solution> {
    const solutions = load<Solution>(STORAGE_KEYS.solutions)
    const idx = solutions.findIndex((s) => s.id === id)
    if (idx === -1) throw new Error(`Solution ${id} not found`)
    solutions[idx] = { ...solutions[idx], ...patch }
    save(STORAGE_KEYS.solutions, solutions)
    return delay(solutions[idx])
  }

  async deleteSolution(id: string): Promise<void> {
    const solutions = load<Solution>(STORAGE_KEYS.solutions).filter((s) => s.id !== id)
    save(STORAGE_KEYS.solutions, solutions)
    return delay(undefined)
  }

  // ── Solution engagement ────────────────────────────────────────────────────
  private mutateSolution(id: string, fn: (s: Solution) => Solution): Promise<Solution> {
    const solutions = load<Solution>(STORAGE_KEYS.solutions)
    const idx = solutions.findIndex((s) => s.id === id)
    if (idx === -1) throw new Error(`Solution ${id} not found`)
    solutions[idx] = fn(solutions[idx])
    save(STORAGE_KEYS.solutions, solutions)
    return delay(solutions[idx])
  }

  async toggleSolutionLike(id: string, userId: string): Promise<Solution> {
    return this.mutateSolution(id, (s) => {
      const likes = new Set(s.likes ?? [])
      const dislikes = new Set(s.dislikes ?? [])
      if (likes.has(userId)) { likes.delete(userId) } else { likes.add(userId); dislikes.delete(userId) }
      return { ...s, likes: [...likes], dislikes: [...dislikes] }
    })
  }

  async toggleSolutionDislike(id: string, userId: string): Promise<Solution> {
    return this.mutateSolution(id, (s) => {
      const likes = new Set(s.likes ?? [])
      const dislikes = new Set(s.dislikes ?? [])
      if (dislikes.has(userId)) { dislikes.delete(userId) } else { dislikes.add(userId); likes.delete(userId) }
      return { ...s, likes: [...likes], dislikes: [...dislikes] }
    })
  }

  async addSolutionComment(id: string, input: { author_id: string; author_name: string; author_role?: Role; body: string; parent_id?: string | null }): Promise<Solution> {
    return this.mutateSolution(id, (s) => {
      const comment: SolutionComment = {
        id: genId(),
        parent_id: input.parent_id ?? null,
        author_id: input.author_id,
        author_name: input.author_name,
        author_role: input.author_role,
        body: input.body.trim(),
        created_at: now(),
        likes: [],
        dislikes: [],
      }
      return { ...s, comments: [...(s.comments ?? []), comment] }
    })
  }

  async deleteSolutionComment(id: string, commentId: string): Promise<Solution> {
    return this.mutateSolution(id, (s) => {
      const all = s.comments ?? []
      // Remove the comment and all of its descendant replies (any depth).
      const toRemove = new Set<string>()
      const collect = (cid: string) => {
        toRemove.add(cid)
        all.filter((c) => (c.parent_id ?? null) === cid).forEach((child) => collect(child.id))
      }
      collect(commentId)
      return { ...s, comments: all.filter((c) => !toRemove.has(c.id)) }
    })
  }

  async toggleSolutionCommentReaction(id: string, commentId: string, userId: string, reaction: 'like' | 'dislike'): Promise<Solution> {
    return this.mutateSolution(id, (s) => ({
      ...s,
      comments: (s.comments ?? []).map((c) => {
        if (c.id !== commentId) return c
        const likes = new Set(c.likes ?? [])
        const dislikes = new Set(c.dislikes ?? [])
        if (reaction === 'like') {
          if (likes.has(userId)) { likes.delete(userId) } else { likes.add(userId); dislikes.delete(userId) }
        } else {
          if (dislikes.has(userId)) { dislikes.delete(userId) } else { dislikes.add(userId); likes.delete(userId) }
        }
        return { ...c, likes: [...likes], dislikes: [...dislikes] }
      }),
    }))
  }

  // ── Client Solutions ───────────────────────────────────────────────────────
  async listClientSolutions(clientId?: string): Promise<ClientSolution[]> {
    let cs = load<ClientSolution>(STORAGE_KEYS.clientSolutions)
    if (clientId) cs = cs.filter((x) => x.client_id === clientId)
    return delay(cs)
  }

  async addClientSolution(clientId: string, solutionId: string): Promise<ClientSolution> {
    const list = load<ClientSolution>(STORAGE_KEYS.clientSolutions)
    const item: ClientSolution = { id: genId(), client_id: clientId, solution_id: solutionId, created_at: now() }
    save(STORAGE_KEYS.clientSolutions, [...list, item])
    return delay(item)
  }

  async removeClientSolution(id: string): Promise<void> {
    save(STORAGE_KEYS.clientSolutions, load<ClientSolution>(STORAGE_KEYS.clientSolutions).filter((x) => x.id !== id))
    return delay(undefined)
  }

  // ── Teams ──────────────────────────────────────────────────────────────────
  async listTeams(): Promise<Team[]> {
    return delay(load<Team>(STORAGE_KEYS.teams))
  }

  async getTeam(id: string): Promise<Team | null> {
    return delay(load<Team>(STORAGE_KEYS.teams).find((t) => t.id === id) ?? null)
  }

  async createTeam(input: Omit<Team, 'id' | 'created_at'>): Promise<Team> {
    const teams = load<Team>(STORAGE_KEYS.teams)
    const team: Team = { ...input, id: genId(), created_at: now() }
    save(STORAGE_KEYS.teams, [...teams, team])
    return delay(team)
  }

  async updateTeam(id: string, patch: Partial<Team>): Promise<Team> {
    const teams = load<Team>(STORAGE_KEYS.teams)
    const idx = teams.findIndex((t) => t.id === id)
    if (idx === -1) throw new Error(`Team ${id} not found`)
    teams[idx] = { ...teams[idx], ...patch }
    save(STORAGE_KEYS.teams, teams)
    return delay(teams[idx])
  }

  // ── Products ───────────────────────────────────────────────────────────────
  async listProducts(): Promise<Product[]> {
    return delay(load<Product>(STORAGE_KEYS.products))
  }

  async getProduct(id: string): Promise<Product | null> {
    return delay(load<Product>(STORAGE_KEYS.products).find((p) => p.id === id) ?? null)
  }

  async createProduct(input: Omit<Product, 'id' | 'created_at'>): Promise<Product> {
    const products = load<Product>(STORAGE_KEYS.products)
    const product: Product = { ...input, id: genId(), created_at: now() }
    save(STORAGE_KEYS.products, [...products, product])
    return delay(product)
  }

  async updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
    const products = load<Product>(STORAGE_KEYS.products)
    const idx = products.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error(`Product ${id} not found`)
    products[idx] = { ...products[idx], ...patch }
    save(STORAGE_KEYS.products, products)
    return delay(products[idx])
  }

  // ── SLA Rules ──────────────────────────────────────────────────────────────
  async listSLARules(): Promise<SLARule[]> {
    return delay(load<SLARule>(STORAGE_KEYS.slaRules))
  }

  async getSLARule(id: string): Promise<SLARule | null> {
    return delay(load<SLARule>(STORAGE_KEYS.slaRules).find((r) => r.id === id) ?? null)
  }

  async upsertSLARule(rule: SLARule): Promise<SLARule> {
    const rules = load<SLARule>(STORAGE_KEYS.slaRules)
    const idx = rules.findIndex((r) => r.id === rule.id)
    if (idx === -1) {
      save(STORAGE_KEYS.slaRules, [...rules, rule])
    } else {
      rules[idx] = rule
      save(STORAGE_KEYS.slaRules, rules)
    }
    return delay(rule)
  }

  // ── Cases ──────────────────────────────────────────────────────────────────
  async listCases(scope: ListScope, filters: CaseFilters = {}): Promise<Paginated<Case>> {
    await this.sweepCaseApprovals()
    let cases = load<Case>(STORAGE_KEYS.cases)

    // Scope filtering
    if (scope.role === 'client') {
      const clients = load<Client>(STORAGE_KEYS.clients)
      const myClients = clients.filter((c) => c.user_id === scope.userId).map((c) => c.id)
      cases = cases.filter((c) => myClients.includes(c.client_id))
    } else if (scope.role === 'support_engineer') {
      cases = cases.filter((c) => c.assignee_id === scope.userId)
    } else if (scope.role === 'team_lead') {
      const user = load<User>(STORAGE_KEYS.users).find((u) => u.id === scope.userId)
      if (user?.team_id) cases = cases.filter((c) => c.team_id === user.team_id)
    } else if (scope.role === 'sales_executive') {
      const myClientIds = load<Client>(STORAGE_KEYS.clients)
        .filter((c) => c.created_by === scope.userId)
        .map((c) => c.id)
      cases = cases.filter((c) => myClientIds.includes(c.client_id))
    }

    // Filters
    // Top-level only: drop sub-cases so they surface only from their parent's
    // detail page, never as standalone cards in the main list.
    if (filters.top_level_only) cases = cases.filter((c) => !c.parent_case_id)
    if (filters.status) cases = cases.filter((c) => c.status === filters.status)
    if (filters.priority) cases = cases.filter((c) => c.priority === filters.priority)
    if (filters.client_id) cases = cases.filter((c) => c.client_id === filters.client_id)
    if (filters.assignee_id) cases = cases.filter((c) => c.assignee_id === filters.assignee_id)
    if (filters.team_id) cases = cases.filter((c) => c.team_id === filters.team_id)
    if (filters.search) {
      const q = filters.search.toLowerCase()
      cases = cases.filter(
        (c) => c.title.toLowerCase().includes(q) || c.reference_no.toLowerCase().includes(q)
      )
    }

    // Sort: active cases first, then closed/resolved; newest-first within each group
    const ACTIVE_STATUSES = new Set(['new', 'triaged', 'assigned', 'in_progress', 'pending_client', 'escalated'])
    cases.sort((a, b) => {
      const ag = ACTIVE_STATUSES.has(a.status) ? 0 : 1
      const bg = ACTIVE_STATUSES.has(b.status) ? 0 : 1
      if (ag !== bg) return ag - bg
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    const page = filters.page ?? 1
    const pageSize = filters.pageSize ?? 20
    const total = cases.length
    const items = cases.slice((page - 1) * pageSize, page * pageSize)

    return delay({ items, total, page, pageSize })
  }

  async getCase(id: string, scope: ListScope): Promise<Case | null> {
    await this.sweepCaseApprovals()
    const c = load<Case>(STORAGE_KEYS.cases).find((x) => x.id === id) ?? null
    if (!c) return delay(null)
    // Scope check
    if (scope.role === 'client') {
      const clients = load<Client>(STORAGE_KEYS.clients)
      const myClients = clients.filter((cl) => cl.user_id === scope.userId).map((cl) => cl.id)
      if (!myClients.includes(c.client_id)) return delay(null)
    }
    return delay(c)
  }

  async createCase(input: Omit<Case, 'id' | 'reference_no' | 'created_at'>, scope: ListScope): Promise<Case> {
    const cases = load<Case>(STORAGE_KEYS.cases)
    const teams = load<Team>(STORAGE_KEYS.teams)
    const seq = String(cases.length + 1).padStart(4, '0')
    const year = new Date().getFullYear()

    // Service-based routing: route to the team that owns the case's service
    // (the team whose solution_ids include this case's solution_id). Fall back
    // to an explicit team_id, then the first team.
    const matchedTeam = teams.find((t) => (t.solution_ids ?? []).includes(input.solution_id))
    const teamId = matchedTeam?.id || input.team_id || teams[0]?.id || 't1'
    const deadline = new Date(Date.now() + APPROVAL_WINDOW_MS).toISOString()

    const newCase: Case = {
      ...input,
      team_id: teamId,
      id: genId(),
      reference_no: `NHQ-${year}-${seq}`,
      created_at: now(),
      status: 'new',
    }
    // Auto-triage immediately
    newCase.status = 'triaged'

    // Pending team-lead approval (30-minute window). If no team owns the
    // service, route the approval straight to the Technical Head.
    const thId = this.firstTechnicalHeadId()
    let approverId: string | undefined
    if (matchedTeam) {
      newCase.approval_status = 'pending'
      newCase.approval_team_id = matchedTeam.id
      newCase.approval_user_id = matchedTeam.lead_user_id
      newCase.approval_deadline = deadline
      approverId = matchedTeam.lead_user_id
    } else {
      newCase.approval_status = 'pending'
      newCase.approval_user_id = thId
      newCase.approval_deadline = deadline
      approverId = thId
    }

    save(STORAGE_KEYS.cases, [...cases, newCase])

    // Audit log: creation (back-dated to new → triaged)
    await this.writeAuditLog({
      actor_id: scope.userId, action: 'create', entity_type: 'case', entity_id: newCase.id,
      after: { reference_no: newCase.reference_no, status: 'new', title: newCase.title },
    })
    await this.writeAuditLog({
      actor_id: 'system', action: 'status_change', entity_type: 'case', entity_id: newCase.id,
      before: { status: 'new' }, after: { status: 'triaged' },
    })

    // Notify the responsible approver — surfaced as a pending approval/acceptance.
    if (approverId) {
      await this.createNotification({
        user_id: approverId, channel: 'in_app', type: 'case_pending_approval',
        payload: {
          case_id: newCase.id, reference_no: newCase.reference_no, title: newCase.title,
          message: `Case ${newCase.reference_no} "${newCase.title}" needs your approval${matchedTeam ? '' : ' — no team is mapped to this service'}`,
        },
        sent_at: now(),
      })
    }

    return delay(newCase)
  }

  async updateCase(id: string, patch: Partial<Case>, scope: ListScope): Promise<Case> {
    const cases = load<Case>(STORAGE_KEYS.cases)
    const idx = cases.findIndex((c) => c.id === id)
    if (idx === -1) throw new Error(`Case ${id} not found`)
    const beforeStatus = cases[idx].status
    cases[idx] = { ...cases[idx], ...patch }
    save(STORAGE_KEYS.cases, cases)

    if (patch.status && patch.status !== beforeStatus) {
      await this.writeAuditLog({
        actor_id: scope.userId, action: 'status_change', entity_type: 'case', entity_id: id,
        before: { status: beforeStatus }, after: { status: patch.status },
      })
    }

    return delay(cases[idx])
  }

  async assignCase(caseId: string, assigneeId: string, scope: ListScope): Promise<Case> {
    requireAccess(scope, 'assign', 'case')
    const cases = load<Case>(STORAGE_KEYS.cases)
    const idx = cases.findIndex((c) => c.id === caseId)
    if (idx === -1) throw new Error(`Case ${caseId} not found`)
    const old = cases[idx]
    const isReassigning = !!old.assignee_id && old.assignee_id !== assigneeId
    const newStatus = old.status === 'triaged' ? 'assigned' : old.status
    cases[idx] = { ...old, assignee_id: assigneeId, status: newStatus }
    save(STORAGE_KEYS.cases, cases)

    await this.writeAuditLog({
      actor_id: scope.userId, action: 'assign', entity_type: 'case', entity_id: caseId,
      before: { assignee_id: old.assignee_id ?? null, status: old.status },
      after: { assignee_id: assigneeId, status: newStatus },
    })

    await this.createNotification({
      user_id: assigneeId, channel: 'in_app',
      type: isReassigning ? 'case_reassigned' : 'case_assigned',
      payload: { case_id: caseId, reference_no: old.reference_no, title: old.title },
      sent_at: now(),
    })

    return delay(cases[idx])
  }

  async escalateCase(caseId: string, scope: ListScope): Promise<Case> {
    requireAccess(scope, 'escalate', 'case')
    const cases = load<Case>(STORAGE_KEYS.cases)
    const idx = cases.findIndex((c) => c.id === caseId)
    if (idx === -1) throw new Error(`Case ${caseId} not found`)
    const old = cases[idx]
    const newLevel = (old.escalation_level ?? 0) + 1
    cases[idx] = { ...old, is_escalated: true, escalation_level: newLevel, status: 'escalated' }
    save(STORAGE_KEYS.cases, cases)

    await this.writeAuditLog({
      actor_id: scope.userId, action: 'escalate', entity_type: 'case', entity_id: caseId,
      before: { status: old.status, is_escalated: false },
      after: { status: 'escalated', is_escalated: true, escalation_level: newLevel },
    })

    const techHeads = load<User>(STORAGE_KEYS.users).filter((u) => u.role === 'technical_head' && u.is_active)
    await Promise.all(techHeads.map((th) =>
      this.createNotification({
        user_id: th.id, channel: 'in_app', type: 'case_escalated',
        payload: { case_id: caseId, reference_no: old.reference_no, title: old.title, escalated_by: scope.userId },
        sent_at: now(),
      })
    ))

    return delay(cases[idx])
  }

  // Shared: find client user_id + team lead user_id for a case
  private async notifyForCase(
    caseRec: Case,
    type: string,
    targets: Array<'client' | 'lead' | 'engineer'>,
  ): Promise<void> {
    const payload = { case_id: caseRec.id, reference_no: caseRec.reference_no, title: caseRec.title }
    const ids = new Set<string>()

    if (targets.includes('client')) {
      const clientRec = load<Client>(STORAGE_KEYS.clients).find((c) => c.id === caseRec.client_id)
      if (clientRec?.user_id) ids.add(clientRec.user_id)
    }
    if (targets.includes('lead')) {
      const teamRec = load<Team>(STORAGE_KEYS.teams).find((t) => t.id === caseRec.team_id)
      if (teamRec?.lead_user_id) ids.add(teamRec.lead_user_id)
    }
    if (targets.includes('engineer') && caseRec.assignee_id) {
      ids.add(caseRec.assignee_id)
    }

    await Promise.all([...ids].map((uid) =>
      this.createNotification({ user_id: uid, channel: 'in_app', type, payload, sent_at: now() })
    ))
  }

  async startWork(caseId: string, scope: ListScope): Promise<Case> {
    requireAccess(scope, 'change_status', 'case')
    const cases = load<Case>(STORAGE_KEYS.cases)
    const idx = cases.findIndex((c) => c.id === caseId)
    if (idx === -1) throw new Error(`Case ${caseId} not found`)
    const old = cases[idx]
    cases[idx] = { ...old, status: 'in_progress' }
    save(STORAGE_KEYS.cases, cases)
    await this.writeAuditLog({ actor_id: scope.userId, action: 'status_change', entity_type: 'case', entity_id: caseId, before: { status: old.status }, after: { status: 'in_progress' } })
    await this.notifyForCase(cases[idx], 'case_in_progress', ['client', 'lead'])
    return delay(cases[idx])
  }

  async requestClientInfo(caseId: string, scope: ListScope, reason?: ClientInfoReason, message?: string): Promise<Case> {
    requireAccess(scope, 'change_status', 'case')
    const cases = load<Case>(STORAGE_KEYS.cases)
    const idx = cases.findIndex((c) => c.id === caseId)
    if (idx === -1) throw new Error(`Case ${caseId} not found`)
    const old = cases[idx]
    cases[idx] = {
      ...old,
      status: 'pending_client',
      pending_client_reason: reason ?? old.pending_client_reason,
      pending_client_message: message ?? old.pending_client_message,
    }
    save(STORAGE_KEYS.cases, cases)
    await this.writeAuditLog({ actor_id: scope.userId, action: 'status_change', entity_type: 'case', entity_id: caseId, before: { status: old.status }, after: { status: 'pending_client', reason: reason ?? null } })
    // If a reason/message was supplied, drop it in as a comment so it appears in
    // the client's timeline conversation (temporary — no new progress step).
    if (message?.trim() || reason) {
      const label = reason ? CLIENT_INFO_REASON_LABELS[reason] : 'More information'
      await this.addComment(
        { case_id: caseId, author_id: scope.userId, body: `📋 ${label} requested${message?.trim() ? `: ${message.trim()}` : ''}`, is_internal: false },
        scope,
      )
    }
    await this.notifyForCase(cases[idx], 'pending_client_action', ['client'])
    return delay(cases[idx])
  }

  async resolveCase(
    caseId: string,
    scope: ListScope,
    resolution?: { root_cause: string; resolution_summary: string; solution: string; notes: string },
  ): Promise<Case> {
    requireAccess(scope, 'resolve', 'case')
    const cases = load<Case>(STORAGE_KEYS.cases)
    const idx = cases.findIndex((c) => c.id === caseId)
    if (idx === -1) throw new Error(`Case ${caseId} not found`)
    const old = cases[idx]
    cases[idx] = {
      ...old,
      status: 'resolved',
      resolved_at: now(),
      ...(resolution && {
        root_cause: resolution.root_cause,
        resolution_summary: resolution.resolution_summary,
        resolution_solution: resolution.solution,
        resolution_notes: resolution.notes,
      }),
    }
    save(STORAGE_KEYS.cases, cases)
    // Mirror resolution details into an RCA record so the reopen-lineage view
    // (which reads getRCA) keeps working.
    if (resolution) {
      await this.upsertRCA({
        case_id: caseId,
        problem: old.title,
        root_cause: resolution.root_cause,
        resolution: resolution.resolution_summary,
        prevention: resolution.notes,
        created_by: scope.userId,
      })
    }
    await this.writeAuditLog({ actor_id: scope.userId, action: 'status_change', entity_type: 'case', entity_id: caseId, before: { status: old.status }, after: { status: 'resolved' } })
    await this.notifyForCase(cases[idx], 'case_resolved', ['client', 'lead'])
    return delay(cases[idx])
  }

  async approveCriticalResolution(caseId: string, scope: ListScope): Promise<Case> {
    if (scope.role !== 'technical_head') throw new Error('Only Technical Head can approve critical resolutions')
    const cases = load<Case>(STORAGE_KEYS.cases)
    const idx = cases.findIndex((c) => c.id === caseId)
    if (idx === -1) throw new Error(`Case ${caseId} not found`)
    const old = cases[idx]
    if (old.priority !== 'critical') throw new Error('Approval is only required for critical-priority cases')
    cases[idx] = { ...old, th_approved: true }
    save(STORAGE_KEYS.cases, cases)
    await this.writeAuditLog({ actor_id: scope.userId, action: 'update', entity_type: 'case', entity_id: caseId, before: { th_approved: false }, after: { th_approved: true } })
    // Notify ML that they can now grant closure
    await this.notifyForCase(cases[idx], 'critical_case_approved', ['lead'])
    return delay(cases[idx])
  }

  // ── Service-based routing approval ──────────────────────────────────────────
  private firstTechnicalHeadId(): string | undefined {
    const users = load<User>(STORAGE_KEYS.users)
    return (users.find((u) => u.role === 'technical_head' && u.is_active) ?? users.find((u) => u.role === 'technical_head'))?.id
  }

  // Lazy server-side escalation sweep: any pending team-lead approval whose
  // 30-minute deadline has passed is reassigned to the Technical Head. Runs on
  // data reads so it fires regardless of which page (if any) is open, and is
  // driven by persisted deadlines so it survives reloads.
  private async sweepCaseApprovals(): Promise<void> {
    const cases = load<Case>(STORAGE_KEYS.cases)
    const nowMs = Date.now()
    const thId = this.firstTechnicalHeadId()
    const escalated: Case[] = []

    for (let i = 0; i < cases.length; i++) {
      const c = cases[i]
      if (
        c.approval_status === 'pending' &&
        c.approval_team_id &&                 // only team-lead pendings escalate
        c.approval_deadline &&
        new Date(c.approval_deadline).getTime() < nowMs
      ) {
        cases[i] = { ...c, approval_status: 'escalated', approval_escalated_at: now(), approval_user_id: thId }
        escalated.push(cases[i])
      }
    }

    if (escalated.length === 0) return
    save(STORAGE_KEYS.cases, cases)

    for (const c of escalated) {
      if (thId) {
        await this.createNotification({
          user_id: thId, channel: 'in_app', type: 'case_approval_escalated',
          payload: {
            case_id: c.id, reference_no: c.reference_no, title: c.title,
            message: `Case ${c.reference_no} "${c.title}" escalated to you — no team-lead response within 30 minutes`,
          },
          sent_at: now(),
        })
      }
      await this.writeAuditLog({
        actor_id: 'system', action: 'update', entity_type: 'case', entity_id: c.id,
        before: { approval_status: 'pending' }, after: { approval_status: 'escalated', reason: 'no_team_lead_response_30m' },
      })
    }
  }

  async acceptCaseApproval(caseId: string, scope: ListScope): Promise<Case> {
    const cases = load<Case>(STORAGE_KEYS.cases)
    const idx = cases.findIndex((c) => c.id === caseId)
    if (idx === -1) throw new Error(`Case ${caseId} not found`)
    const old = cases[idx]
    // Only the designated approver (current team lead / escalated TH) or any
    // Technical Head may accept.
    if (scope.userId !== old.approval_user_id && scope.role !== 'technical_head') {
      throw new Error('Permission denied: you are not the responsible approver for this case')
    }
    if (old.approval_status === 'accepted') return delay(old)
    cases[idx] = { ...old, approval_status: 'accepted', approval_user_id: scope.userId, approval_deadline: undefined }
    save(STORAGE_KEYS.cases, cases)
    await this.writeAuditLog({
      actor_id: scope.userId, action: 'update', entity_type: 'case', entity_id: caseId,
      before: { approval_status: old.approval_status }, after: { approval_status: 'accepted' },
    })
    return delay(cases[idx])
  }

  async grantClosure(caseId: string, scope: ListScope): Promise<Case> {
    requireAccess(scope, 'close', 'case')
    const cases = load<Case>(STORAGE_KEYS.cases)
    const idx = cases.findIndex((c) => c.id === caseId)
    if (idx === -1) throw new Error(`Case ${caseId} not found`)
    const old = cases[idx]
    // Gate: critical cases require TH approval first
    if (old.priority === 'critical' && !old.th_approved && scope.role !== 'technical_head') {
      throw new Error('CRITICAL_APPROVAL_REQUIRED')
    }
    cases[idx] = { ...old, status: 'closed', closed_at: now() }
    save(STORAGE_KEYS.cases, cases)
    // Mark associated feedback as reviewed
    const feedbacks = load<Feedback>(STORAGE_KEYS.feedback)
    const fi = feedbacks.findIndex((f) => f.case_id === caseId)
    if (fi !== -1) { feedbacks[fi] = { ...feedbacks[fi], ml_reviewed: true }; save(STORAGE_KEYS.feedback, feedbacks) }
    await this.writeAuditLog({ actor_id: scope.userId, action: 'status_change', entity_type: 'case', entity_id: caseId, before: { status: old.status }, after: { status: 'closed' } })
    await this.notifyForCase(cases[idx], 'case_closed', ['client', 'engineer'])
    return delay(cases[idx])
  }

  async reopenCase(caseId: string, scope: ListScope): Promise<Case> {
    requireAccess(scope, 'reopen', 'case')
    const cases = load<Case>(STORAGE_KEYS.cases)
    const idx = cases.findIndex((c) => c.id === caseId)
    if (idx === -1) throw new Error(`Case ${caseId} not found`)
    const old = cases[idx]

    // Reopening a fully-closed case spawns a NEW case that carries the old
    // case's data forward and links back to the original via reopened_from_case_id.
    // The original stays closed as the historical record. (Reopening a
    // pending_closure case — e.g. a lead sending it back to the engineer —
    // just moves that same case back in place.)
    if (old.status === 'closed') {
      const seq = String(cases.length + 1).padStart(4, '0')
      const year = new Date().getFullYear()
      // Reset the SLA window relative to now so the reopened case isn't born breached.
      const slaWindowMs = new Date(old.sla_due_at).getTime() - new Date(old.created_at).getTime()
      const reopened: Case = {
        ...old,
        id: genId(),
        reference_no: `NHQ-${year}-${seq}`,
        created_at: now(),
        status: 'in_progress',
        closed_at: undefined,
        resolved_at: undefined,
        is_escalated: false,
        escalation_level: 0,
        th_approved: undefined,
        approval_status: undefined,
        approval_team_id: undefined,
        approval_user_id: undefined,
        approval_deadline: undefined,
        approval_escalated_at: undefined,
        time_intervals: undefined,
        timer_status: undefined,
        sla_due_at: new Date(Date.now() + Math.max(0, slaWindowMs)).toISOString(),
        reopened_from_case_id: old.id,
      }
      cases.push(reopened)
      save(STORAGE_KEYS.cases, cases)
      await this.writeAuditLog({
        actor_id: scope.userId, action: 'create', entity_type: 'case', entity_id: reopened.id,
        before: { reopened_from: old.reference_no }, after: { reference_no: reopened.reference_no, status: 'in_progress' },
      })
      await this.notifyForCase(reopened, 'case_reopened', ['lead', 'engineer'])
      return delay(reopened)
    }

    cases[idx] = { ...old, status: 'in_progress', closed_at: undefined }
    save(STORAGE_KEYS.cases, cases)
    await this.writeAuditLog({ actor_id: scope.userId, action: 'status_change', entity_type: 'case', entity_id: caseId, before: { status: old.status }, after: { status: 'in_progress' } })
    await this.notifyForCase(cases[idx], 'case_reopened', ['lead', 'engineer'])
    return delay(cases[idx])
  }

  // ── Engineer Change Requests (client-raised) ────────────────────────────────
  async requestEngineerChange(caseId: string, reason: string, scope: ListScope): Promise<EngineerChangeRequest> {
    if (scope.role !== 'client') throw new Error('Only the client can request an engineer change')
    const cases = load<Case>(STORAGE_KEYS.cases)
    const idx = cases.findIndex((c) => c.id === caseId)
    if (idx === -1) throw new Error(`Case ${caseId} not found`)
    const c = cases[idx]

    const requests = load<EngineerChangeRequest>(STORAGE_KEYS.engineerChangeRequests)
    if (requests.some((r) => r.case_id === caseId && r.status === 'pending')) {
      throw new Error('An engineer change request is already pending for this case')
    }
    const req: EngineerChangeRequest = {
      id: genId(),
      case_id: caseId,
      requested_by: scope.userId,
      current_engineer_id: c.assignee_id,
      reason,
      status: 'pending',
      created_at: now(),
    }
    save(STORAGE_KEYS.engineerChangeRequests, [...requests, req])

    // Flag the case (badge) WITHOUT changing status — this is a temporary request.
    cases[idx] = { ...c, has_pending_engineer_change: true }
    save(STORAGE_KEYS.cases, cases)
    await this.writeAuditLog({
      actor_id: scope.userId, action: 'update', entity_type: 'case', entity_id: caseId,
      before: {}, after: { engineer_change_requested: true, reason },
    })

    // Notify the team lead and every Technical Head.
    await this.notifyForCase(c, 'engineer_change_requested', ['lead'])
    const techHeads = load<User>(STORAGE_KEYS.users).filter((u) => u.role === 'technical_head' && u.is_active)
    await Promise.all(techHeads.map((th) =>
      this.createNotification({
        user_id: th.id, channel: 'in_app', type: 'engineer_change_requested',
        payload: { case_id: caseId, reference_no: c.reference_no, title: c.title, reason },
        sent_at: now(),
      })
    ))
    return delay(req)
  }

  async listEngineerChangeRequests(caseId: string): Promise<EngineerChangeRequest[]> {
    const requests = load<EngineerChangeRequest>(STORAGE_KEYS.engineerChangeRequests)
      .filter((r) => r.case_id === caseId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return delay(requests)
  }

  async approveEngineerChange(requestId: string, newEngineerId: string, scope: ListScope): Promise<Case> {
    requireAccess(scope, 'assign', 'case')
    const requests = load<EngineerChangeRequest>(STORAGE_KEYS.engineerChangeRequests)
    const ridx = requests.findIndex((r) => r.id === requestId)
    if (ridx === -1) throw new Error('Engineer change request not found')
    const req = requests[ridx]
    if (req.status !== 'pending') throw new Error('This request has already been handled')

    requests[ridx] = { ...req, status: 'approved', resolved_by: scope.userId, new_engineer_id: newEngineerId, resolved_at: now() }
    save(STORAGE_KEYS.engineerChangeRequests, requests)

    // Reassign via the shared helper (writes assignment-history audit + notifies
    // the new engineer). Status stays In Progress — only the engineer changes.
    const updated = await this.assignCase(req.case_id, newEngineerId, scope)

    const cases = load<Case>(STORAGE_KEYS.cases)
    const idx = cases.findIndex((c) => c.id === req.case_id)
    if (idx !== -1) {
      cases[idx] = { ...cases[idx], has_pending_engineer_change: false }
      save(STORAGE_KEYS.cases, cases)
    }
    // Notify the client their request was approved.
    await this.notifyForCase(updated, 'engineer_change_approved', ['client'])
    return delay(cases[idx] ?? updated)
  }

  async rejectEngineerChange(requestId: string, scope: ListScope): Promise<EngineerChangeRequest> {
    requireAccess(scope, 'assign', 'case')
    const requests = load<EngineerChangeRequest>(STORAGE_KEYS.engineerChangeRequests)
    const ridx = requests.findIndex((r) => r.id === requestId)
    if (ridx === -1) throw new Error('Engineer change request not found')
    const req = requests[ridx]
    if (req.status !== 'pending') throw new Error('This request has already been handled')

    requests[ridx] = { ...req, status: 'rejected', resolved_by: scope.userId, resolved_at: now() }
    save(STORAGE_KEYS.engineerChangeRequests, requests)

    const cases = load<Case>(STORAGE_KEYS.cases)
    const idx = cases.findIndex((c) => c.id === req.case_id)
    if (idx !== -1) {
      cases[idx] = { ...cases[idx], has_pending_engineer_change: false }
      save(STORAGE_KEYS.cases, cases)
      await this.writeAuditLog({
        actor_id: scope.userId, action: 'update', entity_type: 'case', entity_id: req.case_id,
        before: { engineer_change_requested: true }, after: { engineer_change_rejected: true },
      })
      await this.notifyForCase(cases[idx], 'engineer_change_rejected', ['client'])
    }
    return delay(requests[ridx])
  }

  // ── Client confirm / reopen ─────────────────────────────────────────────────
  async confirmSolution(caseId: string, feedback: { rating: number; feedback_text: string }, scope: ListScope): Promise<Case> {
    if (scope.role !== 'client') throw new Error('Only the client can confirm the solution')
    if (!feedback.rating || feedback.rating < 1) throw new Error('A rating is required to confirm and close the case')
    const cases = load<Case>(STORAGE_KEYS.cases)
    const idx = cases.findIndex((c) => c.id === caseId)
    if (idx === -1) throw new Error(`Case ${caseId} not found`)
    const old = cases[idx]
    if (old.status !== 'resolved') throw new Error('Only a resolved case can be confirmed')

    // Record the mandatory feedback + rating.
    await this.submitFeedback(
      { case_id: caseId, client_id: old.client_id, feedback_text: feedback.feedback_text, rating: feedback.rating, ml_reviewed: false },
      scope,
    )

    // Close the case directly (client-driven — no team gate in this path).
    cases[idx] = { ...old, status: 'closed', closed_at: now() }
    save(STORAGE_KEYS.cases, cases)
    await this.writeAuditLog({ actor_id: scope.userId, action: 'status_change', entity_type: 'case', entity_id: caseId, before: { status: 'resolved' }, after: { status: 'closed', confirmed_by_client: true } })
    await this.notifyForCase(cases[idx], 'case_closed', ['lead', 'engineer'])
    return delay(cases[idx])
  }

  async clientReopenCase(caseId: string, reason: string, scope: ListScope): Promise<Case> {
    if (scope.role !== 'client') throw new Error('Only the client can reopen from here')
    const cases = load<Case>(STORAGE_KEYS.cases)
    const idx = cases.findIndex((c) => c.id === caseId)
    if (idx === -1) throw new Error(`Case ${caseId} not found`)
    const old = cases[idx]
    if (old.status !== 'resolved') throw new Error('Only a resolved case can be reopened here')

    cases[idx] = { ...old, status: 'in_progress', resolved_at: undefined }
    save(STORAGE_KEYS.cases, cases)
    // Reason becomes a client comment in the conversation.
    await this.addComment(
      { case_id: caseId, author_id: scope.userId, body: `🔄 Reopened: ${reason}`, is_internal: false },
      scope,
    )
    await this.writeAuditLog({ actor_id: scope.userId, action: 'status_change', entity_type: 'case', entity_id: caseId, before: { status: 'resolved' }, after: { status: 'in_progress', reopened_by_client: true, reason } })
    await this.notifyForCase(cases[idx], 'case_reopened', ['lead', 'engineer'])
    return delay(cases[idx])
  }

  // ── Sub-cases ────────────────────────────────────────────────────────────────
  async listSubCases(parentCaseId: string, _scope: ListScope): Promise<Case[]> {
    const cases = load<Case>(STORAGE_KEYS.cases)
    const subs = cases.filter((c) => c.parent_case_id === parentCaseId)
    return delay(subs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()))
  }

  async createSubCase(parentCaseId: string, input: Partial<Case>, scope: ListScope): Promise<Case> {
    // API-side enforcement: only engineering roles may create sub-cases.
    if (!canCreateSubCase(scope.role)) {
      throw new Error(`Permission denied: ${scope.role} cannot create sub-cases`)
    }
    const cases = load<Case>(STORAGE_KEYS.cases)
    const parent = cases.find((c) => c.id === parentCaseId)
    if (!parent) throw new Error(`Parent case ${parentCaseId} not found`)

    const seq = String(cases.length + 1).padStart(4, '0')
    const year = new Date().getFullYear()
    const subCase: Case = {
      // Inherit context from the parent, override with provided fields.
      client_id: parent.client_id,
      solution_id: parent.solution_id,
      product_id: parent.product_id,
      team_id: input.team_id ?? parent.team_id,
      sla_rule_id: parent.sla_rule_id,
      sla_due_at: parent.sla_due_at,
      priority: input.priority ?? parent.priority,
      title: input.title ?? '',
      description: input.description ?? '',
      assignee_id: input.assignee_id,
      escalation_level: 0,
      is_escalated: false,
      ...input,
      id: genId(),
      reference_no: `NHQ-${year}-${seq}`,
      created_at: now(),
      status: input.status ?? 'new',
      parent_case_id: parentCaseId,
      time_intervals: [],
      timer_status: 'not_started',
    }
    save(STORAGE_KEYS.cases, [...cases, subCase])
    await this.writeAuditLog({
      actor_id: scope.userId, action: 'create', entity_type: 'case', entity_id: subCase.id,
      after: { reference_no: subCase.reference_no, parent_case_id: parentCaseId, title: subCase.title },
    })
    return delay(subCase)
  }

  // Timer helpers — intervals are the source of truth.
  private async mutateSubCaseTimer(caseId: string, scope: ListScope, fn: (c: Case) => Case): Promise<Case> {
    const cases = load<Case>(STORAGE_KEYS.cases)
    const idx = cases.findIndex((c) => c.id === caseId)
    if (idx === -1) throw new Error(`Case ${caseId} not found`)
    const updated = fn(cases[idx])
    cases[idx] = updated
    save(STORAGE_KEYS.cases, cases)
    return delay(updated)
  }

  async startSubCaseTimer(caseId: string, scope: ListScope): Promise<Case> {
    return this.mutateSubCaseTimer(caseId, scope, (c) => {
      if (c.timer_status === 'ended') throw new Error('Timer has ended and cannot be restarted')
      if (c.timer_status === 'running') return c
      const intervals = [...(c.time_intervals ?? []), { start: now() }]
      return { ...c, time_intervals: intervals, timer_status: 'running' }
    })
  }

  async pauseSubCaseTimer(caseId: string, scope: ListScope): Promise<Case> {
    return this.mutateSubCaseTimer(caseId, scope, (c) => {
      if (c.timer_status === 'ended') throw new Error('Timer has ended')
      const intervals = [...(c.time_intervals ?? [])]
      if (c.timer_status === 'running') {
        // Stop: close the open interval.
        const last = intervals[intervals.length - 1]
        if (last && !last.end) intervals[intervals.length - 1] = { ...last, end: now() }
        return { ...c, time_intervals: intervals, timer_status: 'paused' }
      }
      // Resume from paused: open a new interval.
      intervals.push({ start: now() })
      return { ...c, time_intervals: intervals, timer_status: 'running' }
    })
  }

  async endSubCaseTimer(caseId: string, scope: ListScope): Promise<Case> {
    return this.mutateSubCaseTimer(caseId, scope, (c) => {
      if (c.timer_status === 'ended') return c
      const intervals = [...(c.time_intervals ?? [])]
      const last = intervals[intervals.length - 1]
      if (last && !last.end) intervals[intervals.length - 1] = { ...last, end: now() }
      return { ...c, time_intervals: intervals, timer_status: 'ended' }
    })
  }

  async closeSubCase(caseId: string, scope: ListScope): Promise<Case> {
    const result = await this.mutateSubCaseTimer(caseId, scope, (c) => {
      if (!c.parent_case_id) throw new Error('Not a sub-case')
      // Ensure timer is stopped before closing.
      const intervals = [...(c.time_intervals ?? [])]
      const last = intervals[intervals.length - 1]
      if (last && !last.end) intervals[intervals.length - 1] = { ...last, end: now() }
      return { ...c, time_intervals: intervals, timer_status: 'ended', status: 'closed', closed_at: now() }
    })
    await this.writeAuditLog({
      actor_id: scope.userId, action: 'status_change', entity_type: 'case', entity_id: caseId,
      after: { status: 'closed' },
    })
    return result
  }

  // ── Comments ───────────────────────────────────────────────────────────────
  async listComments(caseId: string, scope: ListScope): Promise<CaseComment[]> {
    let comments = load<CaseComment>(STORAGE_KEYS.comments).filter((c) => c.case_id === caseId)
    // Clients cannot see internal notes
    if (scope.role === 'client') {
      comments = comments.filter((c) => !c.is_internal)
    }
    return delay(comments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()))
  }

  async addComment(input: Omit<CaseComment, 'id' | 'created_at'>, scope: ListScope): Promise<CaseComment> {
    if (input.is_internal && !canAccess(scope, 'create', 'internal_comment')) {
      throw new Error('Permission denied: cannot create internal comment')
    }
    const comments = load<CaseComment>(STORAGE_KEYS.comments)
    const comment: CaseComment = { ...input, id: genId(), created_at: now() }
    save(STORAGE_KEYS.comments, [...comments, comment])

    // Client reply on pending_client → auto-transition back to in_progress
    if (scope.role === 'client' && !input.is_internal) {
      const cases = load<Case>(STORAGE_KEYS.cases)
      const idx = cases.findIndex((c) => c.id === input.case_id)
      if (idx !== -1 && cases[idx].status === 'pending_client') {
        cases[idx] = { ...cases[idx], status: 'in_progress' }
        save(STORAGE_KEYS.cases, cases)
        await this.writeAuditLog({
          actor_id: scope.userId, action: 'status_change', entity_type: 'case', entity_id: input.case_id,
          before: { status: 'pending_client' }, after: { status: 'in_progress' },
        })
        if (cases[idx].assignee_id) {
          await this.createNotification({
            user_id: cases[idx].assignee_id!, channel: 'in_app', type: 'client_replied',
            payload: { case_id: input.case_id, reference_no: cases[idx].reference_no, title: cases[idx].title },
            sent_at: now(),
          })
        }
      }
    }

    return delay(comment)
  }

  // ── Attachments ────────────────────────────────────────────────────────────
  async listAttachments(caseId: string): Promise<Attachment[]> {
    return delay(load<Attachment>(STORAGE_KEYS.attachments).filter((a) => a.case_id === caseId))
  }

  async addAttachment(input: Omit<Attachment, 'id' | 'created_at'>): Promise<Attachment> {
    const attachments = load<Attachment>(STORAGE_KEYS.attachments)
    const attachment: Attachment = { ...input, id: genId(), created_at: now() }
    save(STORAGE_KEYS.attachments, [...attachments, attachment])
    return delay(attachment)
  }

  async removeAttachment(id: string): Promise<void> {
    const attachments = load<Attachment>(STORAGE_KEYS.attachments)
    save(STORAGE_KEYS.attachments, attachments.filter((a) => a.id !== id))
    return delay(undefined)
  }

  // ── RCA ────────────────────────────────────────────────────────────────────
  async getRCA(caseId: string): Promise<RCA | null> {
    return delay(load<RCA>(STORAGE_KEYS.rcas).find((r) => r.case_id === caseId) ?? null)
  }

  async upsertRCA(input: Omit<RCA, 'id' | 'created_at'>): Promise<RCA> {
    const rcas = load<RCA>(STORAGE_KEYS.rcas)
    const idx = rcas.findIndex((r) => r.case_id === input.case_id)
    if (idx === -1) {
      const rca: RCA = { ...input, id: genId(), created_at: now() }
      save(STORAGE_KEYS.rcas, [...rcas, rca])
      return delay(rca)
    }
    rcas[idx] = { ...rcas[idx], ...input }
    save(STORAGE_KEYS.rcas, rcas)
    return delay(rcas[idx])
  }

  // ── KB Articles ────────────────────────────────────────────────────────────
  async listKBArticles(filters: { status?: string; search?: string } = {}, scope?: ListScope): Promise<KBArticle[]> {
    let articles = load<KBArticle>(STORAGE_KEYS.kbArticles)
    // Visibility enforcement (backend-style): published is public; authors see their
    // own submissions; a Technical Head sees everything.
    if (scope) {
      articles = articles.filter(
        (a) => a.status === 'published' || a.author_id === scope.userId || scope.role === 'technical_head',
      )
    }
    if (filters.status) articles = articles.filter((a) => a.status === filters.status)
    if (filters.search) {
      const terms = filters.search.toLowerCase().split(/\s+/).filter(Boolean)
      articles = articles.filter((a) => {
        const haystack = `${a.title} ${a.body} ${a.tags.join(' ')}`.toLowerCase()
        return terms.some((t) => haystack.includes(t))
      })
    }
    return delay(articles)
  }

  async getKBArticle(id: string): Promise<KBArticle | null> {
    return delay(load<KBArticle>(STORAGE_KEYS.kbArticles).find((a) => a.id === id) ?? null)
  }

  async createKBArticle(input: Omit<KBArticle, 'id' | 'created_at' | 'updated_at'>): Promise<KBArticle> {
    const articles = load<KBArticle>(STORAGE_KEYS.kbArticles)
    const article: KBArticle = { ...input, id: genId(), created_at: now(), updated_at: now() }
    save(STORAGE_KEYS.kbArticles, [...articles, article])
    return delay(article)
  }

  async updateKBArticle(id: string, patch: Partial<KBArticle>): Promise<KBArticle> {
    const articles = load<KBArticle>(STORAGE_KEYS.kbArticles)
    const idx = articles.findIndex((a) => a.id === id)
    if (idx === -1) throw new Error(`KB Article ${id} not found`)
    articles[idx] = { ...articles[idx], ...patch, updated_at: now() }
    save(STORAGE_KEYS.kbArticles, articles)
    return delay(articles[idx])
  }

  async deleteKBArticle(id: string): Promise<void> {
    const articles = load<KBArticle>(STORAGE_KEYS.kbArticles).filter((a) => a.id !== id)
    save(STORAGE_KEYS.kbArticles, articles)
    return delay(undefined)
  }

  // ── KB submission & approval workflow ────────────────────────────────────────
  async submitKBArticle(input: { title: string; body: string; tags: string[]; author_id: string; author_name?: string; author_role?: Role }): Promise<KBArticle> {
    const articles = load<KBArticle>(STORAGE_KEYS.kbArticles)
    const article: KBArticle = {
      id: genId(),
      title: input.title,
      body: input.body,
      tags: input.tags,
      status: 'pending',
      author_id: input.author_id,
      author_name: input.author_name,
      author_role: input.author_role,
      created_at: now(),
      updated_at: now(),
    }
    save(STORAGE_KEYS.kbArticles, [...articles, article])
    return delay(article)
  }

  async publishKBArticle(id: string, actor: ListScope): Promise<KBArticle> {
    if (actor.role !== 'technical_head') throw new Error('Only the Technical Head can publish articles')
    return this.mutateKBArticle(id, (a) => ({
      ...a,
      status: 'published',
      published_at: now(),
      published_by: actor.userId,
      rejected_by: undefined,
      rejection_reason: undefined,
    }))
  }

  async rejectKBArticle(id: string, actor: ListScope, reason?: string): Promise<KBArticle> {
    if (actor.role !== 'technical_head') throw new Error('Only the Technical Head can reject articles')
    return this.mutateKBArticle(id, (a) => ({
      ...a,
      status: 'rejected',
      rejected_by: actor.userId,
      rejection_reason: reason,
    }))
  }

  // ── KB comments ────────────────────────────────────────────────────────────
  private mutateKBArticle(id: string, fn: (a: KBArticle) => KBArticle): Promise<KBArticle> {
    const articles = load<KBArticle>(STORAGE_KEYS.kbArticles)
    const idx = articles.findIndex((a) => a.id === id)
    if (idx === -1) throw new Error(`KB Article ${id} not found`)
    articles[idx] = fn(articles[idx])
    save(STORAGE_KEYS.kbArticles, articles)
    return delay(articles[idx])
  }

  async addKBComment(id: string, input: { author_id: string; author_name: string; author_role?: Role; body: string; parent_id?: string | null }): Promise<KBArticle> {
    return this.mutateKBArticle(id, (a) => {
      const comment: ThreadComment = {
        id: genId(),
        parent_id: input.parent_id ?? null,
        author_id: input.author_id,
        author_name: input.author_name,
        author_role: input.author_role,
        body: input.body.trim(),
        created_at: now(),
        likes: [],
        dislikes: [],
      }
      return { ...a, comments: [...(a.comments ?? []), comment] }
    })
  }

  async deleteKBComment(id: string, commentId: string): Promise<KBArticle> {
    return this.mutateKBArticle(id, (a) => {
      const all = a.comments ?? []
      const toRemove = new Set<string>()
      const collect = (cid: string) => {
        toRemove.add(cid)
        all.filter((c) => (c.parent_id ?? null) === cid).forEach((child) => collect(child.id))
      }
      collect(commentId)
      return { ...a, comments: all.filter((c) => !toRemove.has(c.id)) }
    })
  }

  async toggleKBCommentReaction(id: string, commentId: string, userId: string, reaction: 'like' | 'dislike'): Promise<KBArticle> {
    return this.mutateKBArticle(id, (a) => ({
      ...a,
      comments: (a.comments ?? []).map((c) => {
        if (c.id !== commentId) return c
        const likes = new Set(c.likes ?? [])
        const dislikes = new Set(c.dislikes ?? [])
        if (reaction === 'like') {
          if (likes.has(userId)) { likes.delete(userId) } else { likes.add(userId); dislikes.delete(userId) }
        } else {
          if (dislikes.has(userId)) { dislikes.delete(userId) } else { dislikes.add(userId); likes.delete(userId) }
        }
        return { ...c, likes: [...likes], dislikes: [...dislikes] }
      }),
    }))
  }

  // ── Feedback ───────────────────────────────────────────────────────────────
  async listFeedback(scope: ListScope): Promise<Feedback[]> {
    let feedback = load<Feedback>(STORAGE_KEYS.feedback)
    if (scope.role === 'client') {
      const clients = load<Client>(STORAGE_KEYS.clients)
      const myClients = clients.filter((c) => c.user_id === scope.userId).map((c) => c.id)
      feedback = feedback.filter((f) => myClients.includes(f.client_id))
    }
    return delay(feedback)
  }

  async submitFeedback(input: Omit<Feedback, 'id' | 'created_at'>, scope: ListScope): Promise<Feedback> {
    const list = load<Feedback>(STORAGE_KEYS.feedback)
    const item: Feedback = { ...input, id: genId(), created_at: now() }
    save(STORAGE_KEYS.feedback, [...list, item])
    await this.writeAuditLog({ actor_id: scope.userId, action: 'create', entity_type: 'feedback', entity_id: item.id, after: { case_id: input.case_id } })
    // Transition case: Resolved → Pending Closure
    const cases = load<Case>(STORAGE_KEYS.cases)
    const idx = cases.findIndex((c) => c.id === input.case_id)
    if (idx !== -1 && cases[idx].status === 'resolved') {
      cases[idx] = { ...cases[idx], status: 'pending_closure' }
      save(STORAGE_KEYS.cases, cases)
      await this.writeAuditLog({ actor_id: scope.userId, action: 'status_change', entity_type: 'case', entity_id: input.case_id, before: { status: 'resolved' }, after: { status: 'pending_closure' } })
      await this.notifyForCase(cases[idx], 'feedback_submitted', ['lead'])
    }
    return delay(item)
  }

  async updateFeedback(id: string, patch: Partial<Feedback>): Promise<Feedback> {
    const list = load<Feedback>(STORAGE_KEYS.feedback)
    const idx = list.findIndex((f) => f.id === id)
    if (idx === -1) throw new Error(`Feedback ${id} not found`)
    list[idx] = { ...list[idx], ...patch }
    save(STORAGE_KEYS.feedback, list)
    return delay(list[idx])
  }

  // ── Notifications ──────────────────────────────────────────────────────────
  async listNotifications(userId: string): Promise<Notification[]> {
    await this.sweepCaseApprovals()
    return delay(
      load<Notification>(STORAGE_KEYS.notifications)
        .filter((n) => n.user_id === userId)
        .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
    )
  }

  async markNotificationRead(id: string): Promise<void> {
    const notifications = load<Notification>(STORAGE_KEYS.notifications)
    const idx = notifications.findIndex((n) => n.id === id)
    if (idx !== -1) {
      notifications[idx] = { ...notifications[idx], read_at: now() }
      save(STORAGE_KEYS.notifications, notifications)
    }
    return delay(undefined)
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    const notifications = load<Notification>(STORAGE_KEYS.notifications).map((n) =>
      n.user_id === userId ? { ...n, read_at: now() } : n
    )
    save(STORAGE_KEYS.notifications, notifications)
    return delay(undefined)
  }

  async createNotification(input: Omit<Notification, 'id'>): Promise<Notification> {
    const notifications = load<Notification>(STORAGE_KEYS.notifications)
    const notification: Notification = { ...input, id: genId() }
    save(STORAGE_KEYS.notifications, [...notifications, notification])

    // Multi-channel dispatch — fire stub adapters for non-in_app channels the user enabled
    const allPrefs = load<UserNotificationPrefs>(STORAGE_KEYS.notifPrefs)
    const userPrefs = allPrefs.find((p) => p.user_id === input.user_id)
    if (userPrefs && userPrefs.channels.length > 1) {
      const message = String((input.payload as Record<string, unknown>).message ?? input.type.replace(/_/g, ' '))
      dispatchToChannels(ALL_ADAPTERS, userPrefs.channels, {
        userId: input.user_id,
        type: input.type,
        message,
        meta: input.payload,
      })
    }

    return delay(notification)
  }

  // ── Audit Logs ─────────────────────────────────────────────────────────────
  async listAuditLogs(filters: { entity_type?: string; entity_id?: string; actor_id?: string; limit?: number } = {}): Promise<AuditLog[]> {
    let logs = load<AuditLog>(STORAGE_KEYS.auditLogs)
    if (filters.entity_type) logs = logs.filter((l) => l.entity_type === filters.entity_type)
    if (filters.entity_id) logs = logs.filter((l) => l.entity_id === filters.entity_id)
    if (filters.actor_id) logs = logs.filter((l) => l.actor_id === filters.actor_id)
    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    if (filters.limit) logs = logs.slice(0, filters.limit)
    return delay(logs)
  }

  async writeAuditLog(entry: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
    const logs = load<AuditLog>(STORAGE_KEYS.auditLogs)
    const log: AuditLog = { ...entry, id: genId(), created_at: now() }
    save(STORAGE_KEYS.auditLogs, [...logs, log])
    return delay(log)
  }

  // ── Prospects ──────────────────────────────────────────────────────────────
  async listProspects(scope: ListScope): Promise<Prospect[]> {
    let prospects = load<Prospect>(STORAGE_KEYS.prospects)
    if (scope.role === 'sales_executive') {
      prospects = prospects.filter((p) => p.created_by === scope.userId)
    }
    return delay(prospects.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
  }

  async getProspect(id: string): Promise<Prospect | null> {
    return delay(load<Prospect>(STORAGE_KEYS.prospects).find((p) => p.id === id) ?? null)
  }

  async createProspect(input: Omit<Prospect, 'id' | 'created_at' | 'updated_at'>, scope: ListScope): Promise<Prospect> {
    const prospects = load<Prospect>(STORAGE_KEYS.prospects)
    const prospect: Prospect = { ...input, id: genId(), created_at: now(), updated_at: now() }
    save(STORAGE_KEYS.prospects, [...prospects, prospect])
    await this.writeAuditLog({ actor_id: scope.userId, action: 'create', entity_type: 'prospect', entity_id: prospect.id, after: { company_name: prospect.company_name, stage: prospect.stage } })
    return delay(prospect)
  }

  async updateProspect(id: string, patch: Partial<Prospect>, scope: ListScope): Promise<Prospect> {
    const prospects = load<Prospect>(STORAGE_KEYS.prospects)
    const idx = prospects.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error(`Prospect ${id} not found`)
    const before = { stage: prospects[idx].stage }
    prospects[idx] = { ...prospects[idx], ...patch, updated_at: now() }
    save(STORAGE_KEYS.prospects, prospects)
    await this.writeAuditLog({ actor_id: scope.userId, action: 'update', entity_type: 'prospect', entity_id: id, before, after: { stage: prospects[idx].stage } })
    // Fire in-app notification to AM when stage changes
    if (patch.stage && patch.stage !== before.stage) {
      await this.createNotification({
        user_id: scope.userId,
        channel: 'in_app',
        type: 'prospect_stage_changed',
        payload: { prospect_id: id, company_name: prospects[idx].company_name, stage: patch.stage },
        sent_at: now(),
      })
    }
    return delay(prospects[idx])
  }

  async deleteProspect(id: string, scope: ListScope): Promise<void> {
    save(STORAGE_KEYS.prospects, load<Prospect>(STORAGE_KEYS.prospects).filter((p) => p.id !== id))
    await this.writeAuditLog({ actor_id: scope.userId, action: 'delete', entity_type: 'prospect', entity_id: id })
    return delay(undefined)
  }

  async createClientAccount(
    input: CreateClientAccountInput,
    scope: ListScope
  ): Promise<{ client: Client; user: User; solutions: ClientSolution[] }> {
    // 1. Create linked client user
    const slug = input.company_name.toLowerCase().replace(/[^a-z0-9]/g, '.')
    const user: User = {
      id: genId(),
      name: input.contact_person,
      email: input.email || `${slug}.client@nhq.internal`,
      role: 'client',
      is_active: true,
      created_at: now(),
    }
    save(STORAGE_KEYS.users, [...load<User>(STORAGE_KEYS.users), user])

    // 2. Create client record
    const client: Client = {
      id: genId(),
      user_id: user.id,
      company_name: input.company_name,
      contact_person: input.contact_person,
      phone: input.phone,
      email: input.email || undefined,
      business_context: input.business_context,
      pre_sales_notes: input.pre_sales_notes,
      created_by: scope.userId,
      created_at: now(),
    }
    save(STORAGE_KEYS.clients, [...load<Client>(STORAGE_KEYS.clients), client])

    // 3. Create ClientSolution rows
    const newSolutions: ClientSolution[] = input.solution_ids.map((sid) => ({
      id: genId(), client_id: client.id, solution_id: sid, created_at: now(),
    }))
    save(STORAGE_KEYS.clientSolutions, [...load<ClientSolution>(STORAGE_KEYS.clientSolutions), ...newSolutions])

    // 4. Mark prospect converted if applicable
    if (input.prospect_id) {
      const prospects = load<Prospect>(STORAGE_KEYS.prospects)
      const idx = prospects.findIndex((p) => p.id === input.prospect_id)
      if (idx !== -1) {
        prospects[idx] = { ...prospects[idx], stage: 'closed_won', converted_client_id: client.id, updated_at: now() }
        save(STORAGE_KEYS.prospects, prospects)
      }
    }

    // 5. Audit log
    await this.writeAuditLog({
      actor_id: scope.userId, action: 'create', entity_type: 'client', entity_id: client.id,
      after: { company_name: client.company_name, solutions: input.solution_ids, user_id: user.id },
    })

    return delay({ client, user, solutions: newSolutions })
  }

  // ── Phase Final: Performance metrics ──────────────────────────────────────
  async getEngineerMetrics(engineerId: string, _scope: ListScope): Promise<EngineerMetrics> {
    const allCases = load<Case>(STORAGE_KEYS.cases)
    const allFeedback = load<Feedback>(STORAGE_KEYS.feedback)

    const resolved = allCases.filter(
      (c) => c.assignee_id === engineerId && ['resolved', 'pending_closure', 'closed'].includes(c.status) && c.resolved_at
    )
    const openCases = allCases.filter(
      (c) => c.assignee_id === engineerId && !['resolved', 'pending_closure', 'closed'].includes(c.status)
    ).length

    let avgResolutionHours: number | null = null
    if (resolved.length > 0) {
      const totalMs = resolved.reduce((sum, c) => {
        return sum + (new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime())
      }, 0)
      avgResolutionHours = Math.round((totalMs / resolved.length / 3_600_000) * 10) / 10
    }

    const resolvedWithinSLA = resolved.filter((c) => new Date(c.resolved_at!) <= new Date(c.sla_due_at)).length
    const slaCompliancePct = resolved.length > 0 ? Math.round((resolvedWithinSLA / resolved.length) * 100) : 0

    const resolvedIds = new Set(resolved.map((c) => c.id))
    const myFeedback = allFeedback.filter((f) => resolvedIds.has(f.case_id) && f.rating != null)
    let satisfactionScore: number | null = null
    if (myFeedback.length > 0) {
      satisfactionScore = Math.round((myFeedback.reduce((s, f) => s + (f.rating ?? 0), 0) / myFeedback.length) * 10) / 10
    }

    return delay({
      engineer_id: engineerId,
      total_resolved: resolved.length,
      avg_resolution_hours: avgResolutionHours,
      sla_compliance_pct: slaCompliancePct,
      satisfaction_score: satisfactionScore,
      open_cases: openCases,
      total_feedback_count: myFeedback.length,
    })
  }

  async listAllEngineerMetrics(_scope: ListScope): Promise<EngineerMetrics[]> {
    const users = load<User>(STORAGE_KEYS.users)
    const engineers = users.filter((u) => u.role === 'support_engineer' && u.is_active)
    const metrics = await Promise.all(
      engineers.map((u) => this.getEngineerMetrics(u.id, _scope))
    )
    return delay(metrics.sort((a, b) => b.total_resolved - a.total_resolved))
  }

  // ── Phase Final: Notification preferences ─────────────────────────────────
  async getUserNotifPrefs(userId: string): Promise<UserNotificationPrefs> {
    const all = load<UserNotificationPrefs>(STORAGE_KEYS.notifPrefs)
    return delay(all.find((p) => p.user_id === userId) ?? { user_id: userId, channels: ['in_app'] })
  }

  async updateUserNotifPrefs(userId: string, channels: NotificationChannel[]): Promise<UserNotificationPrefs> {
    const all = load<UserNotificationPrefs>(STORAGE_KEYS.notifPrefs)
    const idx = all.findIndex((p) => p.user_id === userId)
    const prefs: UserNotificationPrefs = { user_id: userId, channels: ['in_app', ...channels.filter((c) => c !== 'in_app')] }
    if (idx === -1) {
      save(STORAGE_KEYS.notifPrefs, [...all, prefs])
    } else {
      all[idx] = prefs
      save(STORAGE_KEYS.notifPrefs, all)
    }
    return delay(prefs)
  }

  // ── Case Transfer Requests ─────────────────────────────────────────────────
  async listCaseTransferRequests(teamId: string): Promise<CaseTransferRequest[]> {
    const all = load<CaseTransferRequest>(STORAGE_KEYS.caseTransferRequests)
    return delay(all.filter((r) => r.team_id === teamId))
  }

  async listAllPendingCaseTransferRequests(): Promise<CaseTransferRequest[]> {
    const all = load<CaseTransferRequest>(STORAGE_KEYS.caseTransferRequests)
    return delay(all.filter((r) => r.status === 'pending'))
  }

  async createCaseTransferRequest(input: Omit<CaseTransferRequest, 'id' | 'created_at'>): Promise<CaseTransferRequest> {
    const all = load<CaseTransferRequest>(STORAGE_KEYS.caseTransferRequests)
    const req: CaseTransferRequest = { ...input, id: genId(), created_at: now() }
    save(STORAGE_KEYS.caseTransferRequests, [...all, req])
    return delay(req)
  }

  async updateCaseTransferRequest(id: string, patch: Partial<CaseTransferRequest>): Promise<CaseTransferRequest> {
    const all = load<CaseTransferRequest>(STORAGE_KEYS.caseTransferRequests)
    const idx = all.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error(`CaseTransferRequest ${id} not found`)
    all[idx] = { ...all[idx], ...patch }
    save(STORAGE_KEYS.caseTransferRequests, all)
    return delay(all[idx])
  }

  // ── Team Member Requests ───────────────────────────────────────────────────
  async listTeamMemberRequests(teamId: string): Promise<TeamMemberRequest[]> {
    const all = load<TeamMemberRequest>(STORAGE_KEYS.teamMemberRequests)
    return delay(all.filter((r) => r.team_id === teamId))
  }

  async listAllPendingTeamMemberRequests(): Promise<TeamMemberRequest[]> {
    const all = load<TeamMemberRequest>(STORAGE_KEYS.teamMemberRequests)
    return delay(all.filter((r) => r.status === 'pending'))
  }

  async createTeamMemberRequest(input: Omit<TeamMemberRequest, 'id' | 'created_at'>): Promise<TeamMemberRequest> {
    const all = load<TeamMemberRequest>(STORAGE_KEYS.teamMemberRequests)
    const req: TeamMemberRequest = { ...input, id: genId(), created_at: now() }
    save(STORAGE_KEYS.teamMemberRequests, [...all, req])
    return delay(req)
  }

  async approveTeamMemberRequest(id: string): Promise<TeamMemberRequest> {
    const all = load<TeamMemberRequest>(STORAGE_KEYS.teamMemberRequests)
    const idx = all.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error(`Request ${id} not found`)
    all[idx] = { ...all[idx], status: 'approved' }
    save(STORAGE_KEYS.teamMemberRequests, all)
    const req = all[idx]
    const users = load<User>(STORAGE_KEYS.users)
    if (req.type === 'add') {
      req.user_ids.forEach((uid) => {
        const ui = users.findIndex((u) => u.id === uid)
        if (ui !== -1) users[ui] = { ...users[ui], team_id: req.team_id }
      })
    } else {
      req.user_ids.forEach((uid) => {
        const ui = users.findIndex((u) => u.id === uid)
        if (ui !== -1) { const u = { ...users[ui] }; delete u.team_id; users[ui] = u }
      })
    }
    save(STORAGE_KEYS.users, users)
    return delay(req)
  }

  async rejectTeamMemberRequest(id: string): Promise<TeamMemberRequest> {
    const all = load<TeamMemberRequest>(STORAGE_KEYS.teamMemberRequests)
    const idx = all.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error(`Request ${id} not found`)
    all[idx] = { ...all[idx], status: 'rejected' }
    save(STORAGE_KEYS.teamMemberRequests, all)
    return delay(all[idx])
  }
}

export const mockDataProvider = new MockDataProvider()
