




'use client'


import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ROLE_LABELS } from '@/lib/rbac'
import { useAuth } from '@/lib/auth/context'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Logo } from './logo'
import {
  LayoutDashboard, Ticket, Building2, Package,
  BookOpen, Shield, Settings, BarChart3, ChevronLeft, ChevronRight,
  Headset, Star, Briefcase, Wrench, LayoutGrid, Newspaper, FolderKanban, Handshake, ShieldX, KeyRound,
} from 'lucide-react'
import type { Role } from '@/types'

export interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: Role[]
  badge?: number
}

export const NAV_ITEMS: NavItem[] = [
  // Main Navigation
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['technical_head', 'team_lead', 'support_engineer', 'sales_executive'] },

// Workspaces
  { label: 'My Cases', href: '/my-case', icon: Wrench, roles: ['support_engineer'] },

// Case Management
  { label: 'Cases', href: '/cases', icon: Ticket, roles: ['technical_head', 'team_lead'] },

// Team Management
  { label: 'Teams', href: '/teams', icon: Headset, roles: ['team_lead', 'technical_head'] },
  { label: 'Team', href: '/team', icon: Headset, roles: ['support_engineer'] },
  { label: 'Engineers', href: '/support-engineer', icon: Wrench, roles: ['technical_head', 'team_lead'] },
  { label: 'Sales Executives', href: '/sales-executive', icon: Briefcase, roles: ['technical_head'] },
  { label: 'Clients', href: '/clients', icon: Building2, roles: ['sales_executive', 'team_lead', 'technical_head'] },

// Resources
  { label: 'Products', href: '/products', icon: Package, roles: ['sales_executive', 'client', 'technical_head'] },
  { label: 'Articles', href: '/articles', icon: Newspaper, roles: ['team_lead', 'technical_head', 'support_engineer'] },
  { label: 'Projects', href: '/projects', icon: FolderKanban, roles: ['technical_head', 'team_lead', 'support_engineer', 'sales_executive'] },
  { label: 'Orders', href: '/engagements', icon: Handshake, roles: ['sales_executive', 'technical_head'] },
  { label: 'License & SLA Monitoring', href: '/license-sla', icon: ShieldX, roles: ['sales_executive'] },

// Analytics & Quality
  { label: 'Reporting', href: '/reporting', icon: BarChart3, roles: ['team_lead', 'technical_head'] },
  { label: 'Feedback', href: '/feedback', icon: Star, roles: ['team_lead', 'technical_head'] },
  { label: 'My Feedback', href: '/my-feedback', icon: Star, roles: ['support_engineer'] },

// Administration
//   { label: 'SLA Rules', href: '/sla-rules', icon: Shield, roles: ['technical_head'] },
  { label: 'Audit Log', href: '/audit-log', icon: Shield, roles: ['technical_head'] },
  { label: 'Permission Management', href: '/permissions', icon: KeyRound, roles: ['technical_head'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['technical_head', 'team_lead', 'support_engineer', 'sales_executive'] },

// ==============================
// Client Portal
// ==============================
  { label: 'My Portal', href: '/client', icon: LayoutDashboard, roles: ['client'] },
  { label: 'My Cases', href: '/client/cases', icon: Ticket, roles: ['client'] },
  { label: 'Services', href: '/client/services', icon: LayoutGrid, roles: ['client'] },
  { label: 'Knowledge Base', href: '/client/kb', icon: BookOpen, roles: ['client'] },
  { label: 'My Feedback', href: '/my-feedback', icon: Star, roles: ['client'] },
]

// Routes whose href would otherwise prefix-match a sibling route via
// pathname.startsWith() (e.g. /client → /clients, /team → /teams, /team-lead).
export const EXACT_MATCH_ROUTES = ['/client', '/team']

interface SidebarProps {
  userName?: string
  userRole?: Role
}

export function Sidebar({ userName = 'User', userRole }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [navScrolling, setNavScrolling] = useState(false)
  const navScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathname = usePathname()
  const { session } = useAuth()
  const role = userRole ?? session?.role

  const handleNavScroll = () => {
    setNavScrolling(true)
    if (navScrollTimeout.current) clearTimeout(navScrollTimeout.current)
    navScrollTimeout.current = setTimeout(() => setNavScrolling(false), 800)
  }

  useEffect(() => () => {
    if (navScrollTimeout.current) clearTimeout(navScrollTimeout.current)
  }, [])

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  )

  return (
    <aside
      className={cn(
        'relative hidden md:flex md:flex-col h-full bg-card transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn('flex h-14 items-center  overflow-hidden ', collapsed ? 'justify-center px-2' : 'px-4')}>
        <Link href="/dashboard" className="flex max-w-full items-center justify-center">
          <Logo className="h-14 w-auto" />
        </Link>
      </div>

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto border-r scrollbar-auto-hide py-3 px-2 space-y-0.5"
        onScroll={handleNavScroll}
        data-scrolling={navScrolling}
      >
        {visibleItems.map((item) => {
          // Exact match for short/root-level routes whose href would otherwise
          // prefix-match a sibling route (e.g. /client → /clients, /team → /teams, /team-lead)
          const isActive = EXACT_MATCH_ROUTES.includes(item.href)
            ? pathname === item.href
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

      {/* Footer: user info + collapse toggle (bottom-left) */}
      <div className="p-3 border-r">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2.5 min-w-0 rounded-lg px-2 py-2">
              <UserAvatar name={userName} userId={session?.userId} size="sm" border={false} shadow={false} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{userName}</p>
                {role && <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[role]}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background hover:bg-accent transition-colors"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="mx-auto flex h-7 w-7 items-center justify-center rounded-md border bg-background hover:bg-accent transition-colors"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </aside>
  )
}
