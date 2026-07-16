import type { Role } from '@/types'

export interface RBACScope {
  userId: string
  role: Role
}

type Action =
  | 'create' | 'read' | 'update' | 'delete'
  | 'assign' | 'escalate' | 'resolve' | 'close' | 'reopen'
  | 'triage' | 'change_status'
  | 'create_internal_comment'
  | 'manage_users' | 'manage_teams' | 'manage_solutions'
  | 'manage_products' | 'manage_kb' | 'manage_sla'
  | 'view_audit_log' | 'view_all_cases' | 'view_feedback'
  | 'review_feedback'
  | 'manage_prospects' | 'create_client_account'

type Resource =
  | 'case' | 'comment' | 'internal_comment' | 'attachment' | 'rca'
  | 'user' | 'client' | 'solution' | 'team' | 'product'
  | 'kb_article' | 'sla_rule' | 'feedback' | 'audit_log'
  | 'notification' | 'system_settings'
  | 'prospect' | 'pre_sales_note'

// Permissions matrix
const PERMISSIONS: Record<Role, Partial<Record<Resource, Action[]>>> = {
  client: {
    case: ['create', 'read'],
    comment: ['create', 'read'],
    attachment: ['create', 'read'],
    feedback: ['create', 'read'],
    notification: ['read'],
    product: ['read'],
  },

  sales_executive: {
    case: ['create', 'read', 'update', 'triage'],
    comment: ['create', 'read'],
    internal_comment: ['create', 'read'],
    attachment: ['create', 'read'],
    client: ['create', 'read', 'update'],
    prospect: ['create', 'read', 'update', 'delete', 'manage_prospects', 'create_client_account'],
    feedback: ['read'],
    notification: ['read'],
    kb_article: ['read'],
    pre_sales_note: ['create', 'read', 'update', 'delete'],
    product: ['read'],
  },

  support_engineer: {
    case: ['read', 'update', 'change_status', 'resolve'],
    comment: ['create', 'read'],
    internal_comment: ['create', 'read'],
    attachment: ['create', 'read'],
    rca: ['create', 'update', 'read'],
    feedback: ['read'],
    notification: ['read'],
    kb_article: ['read'],
  },

  team_lead: {
    case: ['create', 'read', 'update', 'triage', 'assign', 'escalate', 'change_status', 'resolve', 'close', 'reopen'],
    comment: ['create', 'read'],
    internal_comment: ['create', 'read'],
    attachment: ['create', 'read'],
    rca: ['create', 'update', 'read', 'delete'],
    client: ['read'],
    team: ['read', 'update', 'manage_teams'],
    feedback: ['read', 'review_feedback', 'view_feedback'],
    notification: ['read'],
    kb_article: ['create', 'read', 'update', 'manage_kb'],
    audit_log: ['read', 'view_audit_log'],
  },

  technical_head: {
    case: ['create', 'read', 'update', 'delete', 'triage', 'assign', 'escalate', 'change_status', 'resolve', 'close', 'reopen'],
    comment: ['create', 'read', 'delete'],
    internal_comment: ['create', 'read', 'delete'],
    attachment: ['create', 'read', 'delete'],
    rca: ['create', 'update', 'read', 'delete'],
    user: ['create', 'read', 'update', 'delete', 'manage_users'],
    client: ['create', 'read', 'update', 'delete'],
    solution: ['create', 'read', 'update', 'delete', 'manage_solutions'],
    team: ['create', 'read', 'update', 'delete', 'manage_teams'],
    product: ['create', 'read', 'update', 'delete', 'manage_products'],
    kb_article: ['create', 'read', 'update', 'delete', 'manage_kb'],
    sla_rule: ['create', 'read', 'update', 'delete', 'manage_sla'],
    feedback: ['read', 'review_feedback', 'view_feedback'],
    audit_log: ['read', 'view_audit_log'],
    notification: ['read'],
    system_settings: ['read', 'update'],
    prospect: ['read'],
  },
}

export function canAccess(
  scope: RBACScope,
  action: Action,
  resource: Resource,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _record?: Record<string, unknown>
): boolean {
  const allowed = PERMISSIONS[scope.role]?.[resource] ?? []
  return allowed.includes(action)
}

export function requireAccess(scope: RBACScope, action: Action, resource: Resource): void {
  if (!canAccess(scope, action, resource)) {
    throw new Error(`Permission denied: ${scope.role} cannot ${action} ${resource}`)
  }
}

// Sub-case creation is limited to engineering roles regardless of the general
// `case:create` permission (support engineers can create sub-cases but not
// top-level cases). Note: the spec's "technical_lead" maps to "technical_head".
export const SUBCASE_CREATOR_ROLES: Role[] = ['support_engineer', 'team_lead', 'technical_head']

export function canCreateSubCase(role: Role): boolean {
  return SUBCASE_CREATOR_ROLES.includes(role)
}

// Only the Technical Head and Team Leads get the engineer-assignment picker
// when creating a sub-task. Support engineers can still create sub-cases
// (inheriting the parent's assignee), just without a manual picker.
export const SUBCASE_ASSIGNER_ROLES: Role[] = ['team_lead', 'technical_head']

export function canAssignSubCaseEngineer(role: Role): boolean {
  return SUBCASE_ASSIGNER_ROLES.includes(role)
}

export const ROLE_LABELS: Record<Role, string> = {
  client: 'Client',
  sales_executive: 'Sales Executive',
  support_engineer: 'Support Engineer',
  team_lead: 'Team Lead',
  technical_head: 'Technical Head',
}
