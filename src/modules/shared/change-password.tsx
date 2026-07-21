'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { KeyRound, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ForgotPasswordDialog } from './forgot-password-dialog'

const MIN_LENGTH = 8

export function PasswordInput({ id, value, onChange, placeholder }: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        className="pr-9"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export function ChangePasswordCard() {
  const session = useSession()
  const dp = getDataProvider()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)

  const mutation = useMutation({
    mutationFn: () => dp.changePassword(session.userId, current, next),
    onSuccess: () => {
      toast({ title: 'Password updated', variant: 'success' })
      setCurrent('')
      setNext('')
      setConfirm('')
    },
    onError: (err: Error) => toast({ title: err.message || 'Failed to update password', variant: 'destructive' }),
  })

  const touched = current.length > 0 || next.length > 0 || confirm.length > 0
  const lengthOk = next.length >= MIN_LENGTH
  const matchOk = next.length > 0 && next === confirm
  const differentOk = current.length === 0 || next !== current
  const canSubmit = current.length > 0 && lengthOk && matchOk && differentOk

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
          <KeyRound className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Change Password</p>
          <p className="text-xs text-muted-foreground">Update the password used to sign in to your account</p>
        </div>
      </div>

      <div className="space-y-3 pl-11">
        <div className="space-y-1.5">
          <Label htmlFor="current-password" className="text-xs text-muted-foreground">Current password</Label>
          <PasswordInput id="current-password" value={current} onChange={setCurrent} placeholder="Enter current password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password" className="text-xs text-muted-foreground">New password</Label>
          <PasswordInput id="new-password" value={next} onChange={setNext} placeholder="At least 8 characters" />
          {touched && next.length > 0 && !lengthOk && (
            <p className="text-xs text-red-500">Password must be at least {MIN_LENGTH} characters</p>
          )}
          {touched && !differentOk && (
            <p className="text-xs text-red-500">New password must be different from the current one</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password" className="text-xs text-muted-foreground">Confirm new password</Label>
          <PasswordInput id="confirm-password" value={confirm} onChange={setConfirm} placeholder="Re-enter new password" />
          {touched && confirm.length > 0 && !matchOk && (
            <p className="text-xs text-red-500">Passwords do not match</p>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={() => setForgotOpen(true)}
            className="text-xs text-muted-foreground hover:underline self-start sm:self-auto"
          >
            Forgot Password?
          </button>
          <Button
            size="sm"
            variant={canSubmit ? 'default' : 'outline'}
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
            className={cn('w-full sm:w-auto', !canSubmit && 'text-muted-foreground')}
          >
            {mutation.isPending ? 'Updating…' : 'Update Password'}
          </Button>
        </div>
      </div>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </div>
  )
}
