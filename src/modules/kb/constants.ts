import type { KBArticleStatus, Role } from '@/types'

// Curated categories (admin-managed once the backend exists; a static list today).
export const KB_CATEGORIES = [
  'Installation',
  'Configuration',
  'Troubleshooting',
  'Networking',
  'Authentication',
  'Performance',
  'Licensing',
  'API',
  'Security',
  'Best Practices',
  'FAQ',
] as const

// Suggested tags shown in the editor; authors can add their own too.
export const KB_SUGGESTED_TAGS = ['Windows', 'Linux', 'Docker', 'SSL', 'License', 'Proxy', 'Database'] as const

export const KB_STATUS_LABELS: Record<KBArticleStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  published: 'Published',
  archived: 'Archived',
}

export const KB_STATUS_COLORS: Record<KBArticleStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  changes_requested: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  approved: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  archived: 'bg-muted text-muted-foreground',
}

// Permissions: every staff role writes; clients read published articles only.
export const canWriteKB = (role: Role): boolean => role !== 'client'
// Reviewers ("Technical Lead" in the spec → team_lead; technical_head = admin).
export const canReviewKB = (role: Role): boolean => role === 'team_lead' || role === 'technical_head'
export const isKBAdmin = (role: Role): boolean => role === 'technical_head'
