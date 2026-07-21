import {
  UserPlus, AlertTriangle, Gauge, Clock, Hand, ShieldCheck, UserCog, MessageCircle, TrendingUp, KeyRound,
} from 'lucide-react'

export interface NotificationTypeCategory {
  key: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  // Raw `Notification.type` values this category covers — a category is
  // "off" when every one of these is suppressed for the user.
  types: string[]
}

// Every notification-generating code path in the app (case lifecycle events
// in the mock DataProvider, plus the client-side SLA runner) is grouped here
// under a user-facing category so a person can turn a whole category on/off
// without needing to know the internal `type` strings.
export const NOTIFICATION_TYPE_CATEGORIES: NotificationTypeCategory[] = [
  {
    key: 'case_assignment',
    label: 'Case Assignment',
    description: 'When a case or sub-case is assigned to you or your team',
    icon: UserPlus,
    types: ['case_assigned', 'subcase_assigned'],
  },
  {
    key: 'case_escalation',
    label: 'Case Escalation',
    description: 'When a case is escalated manually, automatically, or after an approval timeout',
    icon: AlertTriangle,
    types: ['case_escalated', 'case_auto_escalated', 'case_approval_escalated'],
  },
  {
    key: 'sla_alerts',
    label: 'SLA Alerts',
    description: 'When a case is at risk of breaching its SLA, or has already breached it',
    icon: Gauge,
    types: ['sla_at_risk', 'sla_breached'],
  },
  {
    key: 'engineer_idle',
    label: 'Engineer Idle Alert',
    description: 'When an in-progress case has seen no activity for too long',
    icon: Clock,
    types: ['engineer_idle_alert'],
  },
  {
    key: 'case_claims',
    label: 'Case Claim Requests',
    description: 'When an engineer requests to claim a case, or a claim is rejected',
    icon: Hand,
    types: ['case_claim_requested', 'case_claim_rejected'],
  },
  {
    key: 'approvals',
    label: 'Pending Approvals',
    description: 'When a new case needs your approval before it can be routed',
    icon: ShieldCheck,
    types: ['case_pending_approval'],
  },
  {
    key: 'engineer_changes',
    label: 'Engineer Change Requests',
    description: 'When someone requests to change the engineer assigned to a case',
    icon: UserCog,
    types: ['engineer_change_requested'],
  },
  {
    key: 'client_replies',
    label: 'Client Replies',
    description: "When a client replies on a case that's pending their response",
    icon: MessageCircle,
    types: ['client_replied'],
  },
  {
    key: 'prospect_updates',
    label: 'Prospect Updates',
    description: 'When a sales prospect moves to a new pipeline stage',
    icon: TrendingUp,
    types: ['prospect_stage_changed'],
  },
  {
    key: 'password_expiration',
    label: 'Password Expiration',
    description: 'Reminders to change your password before the scheduled expiration date',
    icon: KeyRound,
    types: ['password_expiration_reminder'],
  },
]

export const ALL_NOTIFICATION_TYPES: string[] = NOTIFICATION_TYPE_CATEGORIES.flatMap((c) => c.types)
