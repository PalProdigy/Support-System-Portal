import type { Role, PermissionAction, PermissionResource, PermissionOverride } from '@/types'

export interface RBACScope {
  userId: string
  role: Role
}

export type Action = PermissionAction
export type Resource = PermissionResource

// Permissions matrix
export const PERMISSIONS: Record<Role, Partial<Record<Resource, Action[]>>> = {
  client: {
    case: ['create', 'read'],
    comment: ['create', 'read'],
    attachment: ['create', 'read'],
    feedback: ['create', 'read'],
    notification: ['read'],
    product: ['read'],
  },

  sales_executive: {
    // View-only on cases — no create/update/comment/attach.
    case: ['read'],
    comment: ['read'],
    internal_comment: ['read'],
    attachment: ['read'],
    client: ['create', 'read', 'update'],
    prospect: ['create', 'read', 'update', 'delete', 'manage_prospects', 'create_client_account'],
    feedback: ['read'],
    notification: ['read'],
    kb_article: ['read'],
    pre_sales_note: ['create', 'read', 'update', 'delete'],
    product: ['read'],
  },

  support_engineer: {
    case: ['create', 'read', 'update', 'change_status', 'resolve'],
    comment: ['create', 'read'],
    internal_comment: ['create', 'read'],
    attachment: ['create', 'read'],
    rca: ['create', 'update', 'read'],
    feedback: ['read'],
    notification: ['read'],
    kb_article: ['read'],
  },

  team_lead: {
    // 'manage_teams' (all teams, admin-wide) is deliberately withheld — a lead
    // only gets 'update' (their own team, scoped by the data layer) plus
    // 'handle_team_cases'. See PERMISSION_CAPABILITIES below.
    case: ['create', 'read', 'update', 'triage', 'assign', 'escalate', 'change_status', 'resolve', 'close', 'reopen', 'handle_team_cases'],
    comment: ['create', 'read'],
    internal_comment: ['create', 'read'],
    attachment: ['create', 'read'],
    rca: ['create', 'update', 'read', 'delete'],
    client: ['read'],
    team: ['read', 'update'],
    feedback: ['read', 'review_feedback', 'view_feedback'],
    notification: ['read'],
    kb_article: ['create', 'read', 'update', 'manage_kb'],
    project: ['manage_projects'],
  },

  technical_head: {
    case: ['create', 'read', 'update', 'delete', 'triage', 'assign', 'escalate', 'change_status', 'resolve', 'close', 'reopen', 'handle_all_cases'],
    comment: ['create', 'read', 'delete'],
    internal_comment: ['create', 'read', 'delete'],
    attachment: ['create', 'read', 'delete'],
    rca: ['create', 'update', 'read', 'delete'],
    user: ['create', 'read', 'update', 'delete', 'manage_users', 'add_engineer', 'add_sales_executive'],
    client: ['create', 'read', 'update', 'delete'],
    solution: ['create', 'read', 'update', 'delete', 'manage_solutions'],
    team: ['create', 'read', 'update', 'delete', 'manage_teams'],
    product: ['create', 'read', 'update', 'delete', 'manage_products'],
    kb_article: ['create', 'read', 'update', 'delete', 'manage_kb'],
    sla_rule: ['create', 'read', 'update', 'delete', 'manage_sla'],
    feedback: ['read', 'review_feedback', 'view_feedback'],
    audit_log: ['read', 'view_audit_log'],
    notification: ['read'],
    system_settings: ['read', 'update', 'manage_permissions'],
    prospect: ['read'],
    project: ['manage_projects'],
    engagement: ['manage_orders'],
  },
}

export interface PermissionCapability {
  key: string
  label: string
  resource: Resource
  action: Action
}

// The named, business-facing permission catalog shown on the Permission
// Management page — a curated subset of (resource, action) pairs rather than
// the full RBAC matrix, so admins toggle capabilities they recognize instead
// of raw RBAC internals.
export const PERMISSION_CAPABILITIES: PermissionCapability[] = [
  { key: 'handle_all_cases', label: 'All Case Handle', resource: 'case', action: 'handle_all_cases' },
  { key: 'handle_team_cases', label: 'Specific Team Case Handle', resource: 'case', action: 'handle_team_cases' },
  { key: 'add_team', label: 'Add Team', resource: 'team', action: 'create' },
  { key: 'manage_specific_team', label: 'Manage Specific Team', resource: 'team', action: 'update' },
  { key: 'manage_all_team', label: 'Manage All Team', resource: 'team', action: 'manage_teams' },
  { key: 'add_engineer', label: 'Add Engineer', resource: 'user', action: 'add_engineer' },
  { key: 'add_sales_executive', label: 'Add Sales Executives', resource: 'user', action: 'add_sales_executive' },
  { key: 'add_client', label: 'Add Clients', resource: 'client', action: 'create' },
  { key: 'add_product', label: 'Add Products', resource: 'product', action: 'create' },
  { key: 'manage_articles', label: 'Manage Articles', resource: 'kb_article', action: 'manage_kb' },
  { key: 'manage_projects', label: 'Manage Projects', resource: 'project', action: 'manage_projects' },
  { key: 'manage_orders', label: 'Manage Order', resource: 'engagement', action: 'manage_orders' },
]

// Kept in sync with STORAGE_KEYS.permissionOverrides in lib/data/mock/index.ts.
// Read directly here (rather than through DataProvider) so canAccess — called
// synchronously from render paths all over the app — never needs to become
// async just to consult a per-user override.
const PERMISSION_OVERRIDES_KEY = 'nhq_permission_overrides'

function loadOverrides(): PermissionOverride[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PERMISSION_OVERRIDES_KEY)
    return raw ? (JSON.parse(raw) as PermissionOverride[]) : []
  } catch {
    return []
  }
}

export function canAccess(
  scope: RBACScope,
  action: Action,
  resource: Resource,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _record?: Record<string, unknown>
): boolean {
  const override = loadOverrides().find(
    (o) => o.user_id === scope.userId && o.resource === resource && o.action === action
  )
  if (override) return override.effect === 'allow'
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
