




'use client'


import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ROLE_LABELS } from '@/lib/rbac'
import { useAuth } from '@/lib/auth/context'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard, Ticket, Users, Building2, Lightbulb, Package,
  BookOpen, Shield, Settings, BarChart3, Bell, ChevronLeft, ChevronRight,
  Headset, Star, Briefcase, Wrench, ShieldAlert, LayoutGrid,
} from 'lucide-react'
import type { Role } from '@/types'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: Role[]
  badge?: number
}

const NAV_ITEMS: NavItem[] = [
  // Staff + shared
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['technical_head', 'team_lead', 'support_engineer', 'sales_executive'] },
  { label: 'Cases', href: '/cases', icon: Ticket, roles: ['technical_head', 'team_lead', 'support_engineer', 'sales_executive'] },
  { label: 'AM Hub', href: '/sales-executive', icon: Briefcase, roles: ['sales_executive'] },
  { label: 'TH Hub', href: '/technical-head', icon: ShieldAlert, roles: ['technical_head'] },
  { label: 'Lead Hub', href: '/lead', icon: Users, roles: ['team_lead'] },
  { label: 'My Cases', href: '/engineer', icon: Wrench, roles: ['support_engineer'] },
  { label: 'Clients', href: '/clients', icon: Building2, roles: ['sales_executive', 'team_lead', 'technical_head'] },
  { label: 'Support Engineers', href: '/support-engineer', icon: Wrench, roles: ['technical_head'] },
  { label: 'Team Leads', href: '/team-lead', icon: Users, roles: ['technical_head'] },
  { label: 'Sales Executives', href: '/sales-executive', icon: Briefcase, roles: ['technical_head'] },
  { label: 'Teams', href: '/teams', icon: Headset, roles: ['team_lead', 'technical_head'] },
  { label: 'Solutions', href: '/solutions', icon: Lightbulb, roles: ['team_lead', 'technical_head', 'support_engineer', 'sales_executive'] },
  { label: 'Products', href: '/products', icon: Package, roles: ['sales_executive', 'client', 'technical_head'] },
  { label: 'Knowledge Base', href: '/knowledge-base', icon: BookOpen, roles: ['technical_head', 'team_lead', 'support_engineer', 'sales_executive', 'client'] },
  { label: 'Reporting', href: '/reporting', icon: BarChart3, roles: ['team_lead', 'technical_head', 'sales_executive'] },
  { label: 'Feedback', href: '/feedback', icon: Star, roles: ['team_lead', 'technical_head'] },
  { label: 'My Feedback', href: '/my-feedback', icon: Star, roles: ['support_engineer'] },
  { label: 'SLA Rules', href: '/sla-rules', icon: Shield, roles: ['technical_head'] },
  { label: 'Audit Log', href: '/audit-log', icon: Shield, roles: ['technical_head', 'team_lead'] },
  { label: 'Notifications', href: '/notifications', icon: Bell, roles: ['technical_head', 'team_lead', 'support_engineer', 'sales_executive'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['technical_head'] },
  // Client portal
  { label: 'My Portal', href: '/client', icon: LayoutDashboard, roles: ['client'] },
  { label: 'My Cases', href: '/client/cases', icon: Ticket, roles: ['client'] },
  { label: 'Services', href: '/client/services', icon: LayoutGrid, roles: ['client'] },
  { label: 'Knowledge Base', href: '/client/kb', icon: BookOpen, roles: ['client'] },
  // Scoped to feedback on the client's own cases (same /my-feedback route + FeedbackBoard `mine`)
  { label: 'My Feedback', href: '/my-feedback', icon: Star, roles: ['client'] },
  { label: 'Notifications', href: '/notifications', icon: Bell, roles: ['client'] },
]

interface SidebarProps {
  userName?: string
  userRole?: Role
}

export function Sidebar({ userName = 'User', userRole }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { session } = useAuth()
  const role = userRole ?? session?.role

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  )

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full border-r bg-card transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn('flex h-14 items-center border-b px-0', collapsed && 'justify-center px-1')}>
        {!collapsed ? (
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-primary font-bold text-lg">
              <img src="/Gnvbo01 (1).svg" alt="Logo" className="w-auto h-20" />
            </span>
          </Link>
        ) : (
          <Link href="/dashboard">
            <span className="text-primary font-bold text-lg">
              <img src="/Gnvbo01 (1).svg" alt="Logo" className="w-auto h-18" />
            </span>
          </Link>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleItems.map((item) => {
          // Exact match for root-level portals to avoid /client matching /clients
          const isActive = item.href === '/client'
            ? pathname === '/client'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      {!collapsed && (
        <>
          <Separator />
          <div className="p-3">
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
              <UserAvatar name={userName} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{userName}</p>
                {role && <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[role]}</p>}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[60px] flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent transition-colors z-10"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  )
}
