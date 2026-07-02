'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Search, Sun, Moon, LogOut, User, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/shared/user-avatar'
import { ROLE_LABELS } from '@/lib/rbac'
import { useAuth } from '@/lib/auth/context'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getDataProvider } from '@/lib/data'
import type { Notification } from '@/types'
import { timeAgo } from '@/lib/utils'

interface TopbarProps {
  userName?: string
}

export function Topbar({ userName = 'User' }: TopbarProps) {
  const { session, logout } = useAuth()
  const router = useRouter()
  const qc = useQueryClient()
  const [dark, setDark] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('nhq_theme')
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDark(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const { data: notifData } = useQuery({
    queryKey: ['notifications', session?.userId],
    queryFn: () => getDataProvider().listNotifications(session!.userId),
    enabled: !!session,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const notifications: Notification[] = notifData ?? []
  const unread = notifications.filter((n) => !n.read_at).length

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('nhq_theme', next ? 'dark' : 'light')
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const markAllRead = async () => {
    if (!session) return
    await getDataProvider().markAllNotificationsRead(session.userId)
    qc.invalidateQueries({ queryKey: ['notifications', session.userId] })
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4 gap-4 shrink-0">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cases… (press Enter)"
            className="pl-9 h-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                router.push(`/cases?search=${encodeURIComponent(searchQuery.trim())}`)
                setSearchQuery('')
              }
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Notifications */}
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={markAllRead}>
                  Mark all read
                </Button>
              )}
            </div>
            <ScrollArea className="max-h-80">
              {notifications.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No notifications</p>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <div
                    key={n.id}
                    className={`flex gap-2.5 px-3 py-2.5 border-b last:border-0 ${!n.read_at ? 'bg-primary/5' : ''}`}
                  >
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground leading-tight">
                        {String((n.payload as { message?: string; title?: string }).message
                          ?? (n.payload as { message?: string; title?: string }).title
                          ?? n.type)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(n.sent_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <UserAvatar name={userName} size="sm" />
              <div className="hidden md:block text-left">
                <p className="text-xs font-medium leading-none">{userName}</p>
                {session?.role && <p className="text-[10px] text-muted-foreground mt-0.5">{ROLE_LABELS[session.role]}</p>}
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Signed in as<br />
              <span className="font-medium text-foreground">{session?.role && ROLE_LABELS[session.role]}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/profile')}>
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400 focus:text-red-600">
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}