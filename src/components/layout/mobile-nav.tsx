'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ROLE_LABELS } from '@/lib/rbac'
import { useAuth } from '@/lib/auth/context'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet'
import { NAV_ITEMS, EXACT_MATCH_ROUTES } from './sidebar'
import { Grid2x2 } from 'lucide-react'
import type { Role } from '@/types'

interface MobileNavProps {
  userName?: string
  userRole?: Role
}

// Bottom tab bar + "More" sheet — the primary navigation surface on phones,
// standing in for the desktop sidebar (hidden below the md breakpoint).
export function MobileNav({ userName = 'User', userRole }: MobileNavProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const pathname = usePathname()
  const { session } = useAuth()
  const role = userRole ?? session?.role

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role)))
  const isActive = (href: string) => (EXACT_MATCH_ROUTES.includes(href) ? pathname === href : pathname.startsWith(href))

  const primaryItems = visibleItems.slice(0, 4)
  const restItems = visibleItems.slice(4)
  const anyPrimaryActive = primaryItems.some((i) => isActive(i.href))

  return (
    <>
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 flex items-stretch bg-card/95 backdrop-blur-md border-t shadow-[0_-1px_8px_rgba(0,0,0,0.04)] [padding-bottom:env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        {primaryItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-w-0"
            >
              <item.icon className={cn('h-5 w-5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
              <span className={cn('text-[10px] font-medium truncate max-w-full px-1', active ? 'text-primary' : 'text-muted-foreground')}>
                {item.label}
              </span>
            </Link>
          )
        })}
        {restItems.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-w-0"
          >
            <Grid2x2 className={cn('h-5 w-5 shrink-0', !anyPrimaryActive && moreOpen ? 'text-primary' : 'text-muted-foreground')} />
            <span className="text-[10px] font-medium text-muted-foreground">More</span>
          </button>
        )}
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="md:hidden max-h-[80vh] overflow-y-auto rounded-t-2xl p-0">
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>

          <div className="flex items-center gap-2.5 px-4 py-3 border-b">
            <UserAvatar name={userName} userId={session?.userId} size="sm" border={false} shadow={false} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{userName}</p>
              {role && <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 p-4 [padding-bottom:calc(1rem+env(safe-area-inset-bottom))]">
            {visibleItems.map((item) => {
              const active = isActive(item.href)
              return (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-colors',
                      active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-transparent bg-muted/40 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="text-[11px] font-medium leading-tight">{item.label}</span>
                  </Link>
                </SheetClose>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
