'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ROLE_LABELS } from '@/lib/rbac'
import { ROLE_USER_MAP } from '@/lib/auth/session'
import type { Role } from '@/types'
import { getDataProvider } from '@/lib/data'

const ROLES: Role[] = [
  'client',
  'account_manager',
  'support_engineer',
  'module_lead',
  'technical_head',
]

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!role) { setError('Please select a role to continue.'); return }

    setLoading(true)
    setError('')

    try {
      // Dummy auth — any email/password accepted, role determines session
      // Initialize mock data (ensures seed is loaded)
      await getDataProvider().listUsers()

      // If email matches a seeded user with matching role, use their id
      const users = await getDataProvider().listUsers()
      const matchByEmail = users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.role === role
      )
      const userId = matchByEmail?.id ?? ROLE_USER_MAP[role]

      login(role, userId)
      router.replace('/dashboard')
    } catch {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-xl mb-3">
            N
          </div>
          <h1 className="text-2xl font-bold text-foreground">NHQ Support Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">NHQ Distributions Ltd.</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border bg-card shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 text-foreground">Sign in</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Any password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(v) => { setRole(v as Role); setError('') }}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-4 rounded-lg bg-muted/60 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Demo mode</p>
            <p className="text-xs text-muted-foreground">
              Any email and password work. Select a role to explore that role&apos;s dashboard with seeded data.
            </p>
          </div>
        </div>

        {/* Role hint */}
        <div className="mt-4 grid grid-cols-1 gap-2">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className="text-left rounded-lg border bg-card px-3 py-2 text-xs hover:bg-accent transition-colors"
            >
              <span className="font-medium text-foreground">{ROLE_LABELS[r]}</span>
              <span className="text-muted-foreground ml-2">{DEMO_HINTS[r]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const DEMO_HINTS: Record<Role, string> = {
  client: '— view your cases & submit feedback',
  account_manager: '— manage clients & track cases',
  support_engineer: '— work assigned cases',
  module_lead: '— oversee team, escalate, assign',
  technical_head: '— full admin access',
}