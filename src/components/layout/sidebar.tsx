




'use client'


import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ROLE_LABELS } from '@/lib/rbac'
import { useAuth } from '@/lib/auth/context'
import { UserAvatar } from '@/components/shared/user-avatar'
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
  // Main Navigation
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['technical_head', 'team_lead', 'support_engineer', 'sales_executive'] },

// Workspaces
  { label: 'TH Hub', href: '/technical-head', icon: ShieldAlert, roles: ['technical_head'] },
  { label: 'Lead Hub', href: '/lead', icon: Users, roles: ['team_lead'] },
  { label: 'AM Hub', href: '/sales-executive', icon: Briefcase, roles: ['sales_executive'] },
  { label: 'My Cases', href: '/my-case', icon: Wrench, roles: ['support_engineer'] },

// Case Management
  { label: 'Cases', href: '/cases', icon: Ticket, roles: ['technical_head', 'team_lead', 'sales_executive'] },

// Team Management
  { label: 'Teams', href: '/teams', icon: Headset, roles: ['team_lead', 'technical_head'] },
  { label: 'Team', href: '/team', icon: Headset, roles: ['support_engineer'] },
  { label: 'Team Leads', href: '/team-lead', icon: Users, roles: ['technical_head'] },
  { label: 'Support Engineers', href: '/support-engineer', icon: Wrench, roles: ['technical_head', 'team_lead'] },
  { label: 'Sales Executives', href: '/sales-executive', icon: Briefcase, roles: ['technical_head'] },
  { label: 'Clients', href: '/clients', icon: Building2, roles: ['sales_executive', 'team_lead', 'technical_head'] },

// Resources
  { label: 'Products', href: '/products', icon: Package, roles: ['sales_executive', 'client', 'technical_head'] },
  { label: 'Solutions', href: '/solutions', icon: Lightbulb, roles: ['team_lead', 'technical_head', 'support_engineer', 'sales_executive'] },
  { label: 'Knowledge Base', href: '/knowledge-base', icon: BookOpen, roles: ['technical_head', 'team_lead', 'support_engineer', 'sales_executive', 'client'] },

// Analytics & Quality
  { label: 'Reporting', href: '/reporting', icon: BarChart3, roles: ['team_lead', 'technical_head', 'sales_executive'] },
  { label: 'Feedback', href: '/feedback', icon: Star, roles: ['team_lead', 'technical_head'] },
  { label: 'My Feedback', href: '/my-feedback', icon: Star, roles: ['support_engineer'] },

// Administration
  { label: 'SLA Rules', href: '/sla-rules', icon: Shield, roles: ['technical_head'] },
  { label: 'Audit Log', href: '/audit-log', icon: Shield, roles: ['technical_head', 'team_lead'] },
  { label: 'Notifications', href: '/notifications', icon: Bell, roles: ['technical_head', 'team_lead', 'support_engineer', 'sales_executive'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['technical_head'] },

// ==============================
// Client Portal
// ==============================
  { label: 'My Portal', href: '/client', icon: LayoutDashboard, roles: ['client'] },
  { label: 'My Cases', href: '/client/cases', icon: Ticket, roles: ['client'] },
  { label: 'Services', href: '/client/services', icon: LayoutGrid, roles: ['client'] },
  { label: 'Knowledge Base', href: '/client/kb', icon: BookOpen, roles: ['client'] },
  { label: 'My Feedback', href: '/my-feedback', icon: Star, roles: ['client'] },
  { label: 'Notifications', href: '/notifications', icon: Bell, roles: ['client'] },
]

// Routes whose href would otherwise prefix-match a sibling route via
// pathname.startsWith() (e.g. /client → /clients, /team → /teams, /team-lead).
const EXACT_MATCH_ROUTES = ['/client', '/team']

interface SidebarProps {
  userName?: string
  userRole?: Role
}

export function Sidebar({ userName = 'User', userRole }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [isDark, setIsDark] = useState(false)
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

  // The theme toggle (in Topbar) flips a `dark` class on <html> — watch it
  // here too so the logo swaps live, without needing a shared theme context.
  useEffect(() => {
    const root = document.documentElement
    setIsDark(root.classList.contains('dark'))
    const observer = new MutationObserver(() => setIsDark(root.classList.contains('dark')))
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full  bg-card transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn('flex h-14 items-center  overflow-hidden ', collapsed ? 'justify-center px-2' : 'px-4')}>
        <Link href="/dashboard" className="flex max-w-full items-center justify-center">
          <svg
              className="h-14 w-auto"
              viewBox="0 0 320 140"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
          >
            {/* NH text */}
            <text
                x="15"
                y="85"
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight="900"
                fontSize="62"
                fill={isDark ? '#FFFFFF' : '#111111'}
                letterSpacing="-2px"
            >
              NH
            </text>

            {/* Distributions text */}
            <text
                x="13"
                y="118"
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight="800"
                fontStyle="italic"
                fontSize="21"
                fill="#D32F2F"
                letterSpacing="4px"
            >
              DISTRIBUTIONS
            </text>

            {/* 3D sphere with concentric grey orbital rings */}
            <g clipPath="url(#ringsClip)">
              {/* Ring 1 */}
              <ellipse
                  cx="150"
                  cy="60"
                  rx="38"
                  ry="17"
                  transform="rotate(-28, 150, 60)"
                  stroke="#9E9E9E"
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
              />
              {/* Ring 2 */}
              <ellipse
                  cx="150"
                  cy="60"
                  rx="52"
                  ry="23"
                  transform="rotate(-28, 150, 60)"
                  stroke="#757575"
                  strokeWidth="3.2"
              />
              {/* Ring 3 */}
              <ellipse
                  cx="150"
                  cy="60"
                  rx="66"
                  ry="29"
                  transform="rotate(-28, 150, 60)"
                  stroke="#BDBDBD"
                  strokeWidth="1.8"
              />
            </g>

            {/* Red Glossy Sphere */}
            <circle cx="145" cy="65" r="30" fill="url(#sphereGradient)" filter="url(#sphereShadow)" />

            {/* White portion of the Swooping Orbit Arc (on the red sphere) */}
            <path
                d="M 125 65 C 125 50, 168 50, 172 68"
                stroke="#FFFFFF"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
            />

            {/* Red portion of the Swooping Orbit Arc (outside the red sphere) */}
            <path
                d="M 171 67 C 176 85, 190 110, 190 130"
                stroke="#D32F2F"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
            />

            {/* Definitions for Gradients and Shadows */}
            <defs>
              {/* Clip path to remove the downside (bottom-left) of the grey orbital rings */}
              <clipPath id="ringsClip">
                <polygon points="80,0 320,0 320,110 135,110 135,55 80,55" />
              </clipPath>
              {/* Radial gradient for the red glossy 3D ball */}
              <radialGradient id="sphereGradient" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#FF8A80" />
                <stop offset="35%" stopColor="#E53935" />
                <stop offset="85%" stopColor="#B71C1C" />
                <stop offset="100%" stopColor="#7F0000" />
              </radialGradient>
              {/* Soft drop shadow for the sphere */}
              <filter id="sphereShadow" x="95" y="25" width="100" height="100" filterUnits="userSpaceOnUse">
                <feDropShadow dx="1" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.18" />
              </filter>
            </defs>
          </svg>
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
