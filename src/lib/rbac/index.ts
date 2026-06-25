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
  | 'prospect'

// Permissions matrix
const PERMISSIONS: Record<Role, Partial<Record<Resource, Action[]>>> = {
  client: {
    case: ['create', 'read'],
    comment: ['create', 'read'],
    attachment: ['create', 'read'],
    feedback: ['create', 'read'],
    notification: ['read'],
  },

  account_manager: {
    case: ['create', 'read', 'update', 'triage'],
    comment: ['create', 'read'],
    internal_comment: ['create', 'read'],
    attachment: ['create', 'read'],
    client: ['create', 'read', 'update'],
    prospect: ['create', 'read', 'update', 'delete', 'manage_prospects', 'create_client_account'],
    feedback: ['read'],
    notification: ['read'],
    kb_article: ['read'],
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

  module_lead: {
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

export const ROLE_LABELS: Record<Role, string> = {
  client: 'Client',
  account_manager: 'Account Manager',
  support_engineer: 'Support Engineer',
  module_lead: 'Module Lead',
  technical_head: 'Technical Head',
}
