'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { PasswordInput } from './change-password'
import { Mail, ShieldCheck, KeyRound, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const MIN_LENGTH = 8
type Step = 'email' | 'code' | 'password' | 'success'

const STEPS: { key: Step; label: string }[] = [
  { key: 'email', label: 'Verify' },
  { key: 'code', label: 'Code' },
  { key: 'password', label: 'Reset' },
]

function genCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function ForgotPasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const session = useSession()
  const dp = getDataProvider()

  const { data: user } = useQuery({
    queryKey: ['user', session.userId],
    queryFn: () => dp.getUser(session.userId),
    enabled: open,
  })

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [sentCode, setSentCode] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (open) {
      setStep('email')
      setCodeInput('')
      setCodeError('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }, [open])

  useEffect(() => {
    if (user?.email) setEmail(user.email)
  }, [user])

  const sendCodeMutation = useMutation({
    mutationFn: async () => {
      const code = genCode()
      setSentCode(code)
      return code
    },
    onSuccess: () => {
      setStep('code')
      toast({ title: 'Verification code sent', description: `A 6-digit code was sent to ${email}`, variant: 'success' })
    },
  })

  const resetMutation = useMutation({
    mutationFn: () => dp.resetPassword(session.userId, newPassword),
    onSuccess: () => setStep('success'),
    onError: () => toast({ title: 'Failed to reset password', variant: 'destructive' }),
  })

  function handleClose(next: boolean) {
    onOpenChange(next)
  }

  function verifyCode() {
    if (codeInput.trim() !== sentCode) {
      setCodeError('Incorrect code. Please try again.')
      return
    }
    setCodeError('')
    setStep('password')
  }

  const lengthOk = newPassword.length >= MIN_LENGTH
  const matchOk = newPassword.length > 0 && newPassword === confirmPassword
  const canSubmit = lengthOk && matchOk

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset your password</DialogTitle>
          <DialogDescription>
            {step === 'success' ? 'All done' : "Follow the steps below to regain access to your account"}
          </DialogDescription>
        </DialogHeader>

        {step !== 'success' && (
          <div className="flex items-center gap-2 px-0.5">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors',
                    i < stepIndex ? 'bg-primary text-primary-foreground'
                      : i === stepIndex ? 'bg-primary/15 text-primary ring-2 ring-primary/40'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {i < stepIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={cn('hidden sm:inline text-xs font-medium truncate', i <= stepIndex ? 'text-foreground' : 'text-muted-foreground')}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <div className={cn('h-px flex-1', i < stepIndex ? 'bg-primary' : 'bg-border')} />}
              </div>
            ))}
          </div>
        )}

        {step === 'email' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="rounded-md bg-primary/10 p-1.5 text-primary shrink-0">
                <Mail className="h-4 w-4" />
              </div>
              <p className="text-xs text-muted-foreground">
                We'll send a 6-digit verification code to the email address on your account.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset-email" className="text-xs text-muted-foreground">Email address</Label>
              <Input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button
              className="w-full sm:w-auto"
              disabled={!email || sendCodeMutation.isPending}
              onClick={() => sendCodeMutation.mutate()}
            >
              {sendCodeMutation.isPending ? 'Sending…' : 'Send Verification Code'}
            </Button>
          </div>
        )}

        {step === 'code' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="rounded-md bg-primary/10 p-1.5 text-primary shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>.
                <span className="block mt-1 text-amber-600 dark:text-amber-400">Demo mode — your code is <span className="font-mono font-semibold">{sentCode}</span></span>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset-code" className="text-xs text-muted-foreground">Verification code</Label>
              <Input
                id="reset-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                value={codeInput}
                onChange={(e) => { setCodeInput(e.target.value.replace(/\D/g, '')); setCodeError('') }}
                className="tracking-[0.3em] text-center font-mono text-lg"
              />
              {codeError && <p className="text-xs text-red-500">{codeError}</p>}
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
              <button
                type="button"
                onClick={() => sendCodeMutation.mutate()}
                disabled={sendCodeMutation.isPending}
                className="text-xs text-primary hover:underline self-start sm:self-auto"
              >
                Resend code
              </button>
              <Button
                className="w-full sm:w-auto"
                disabled={codeInput.length !== 6}
                onClick={verifyCode}
              >
                Verify Code
              </Button>
            </div>
          </div>
        )}

        {step === 'password' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="rounded-md bg-primary/10 p-1.5 text-primary shrink-0">
                <KeyRound className="h-4 w-4" />
              </div>
              <p className="text-xs text-muted-foreground">Choose a new password for your account.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset-new-password" className="text-xs text-muted-foreground">New password</Label>
              <PasswordInput id="reset-new-password" value={newPassword} onChange={setNewPassword} placeholder="At least 8 characters" />
              {newPassword.length > 0 && !lengthOk && (
                <p className="text-xs text-red-500">Password must be at least {MIN_LENGTH} characters</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset-confirm-password" className="text-xs text-muted-foreground">Confirm new password</Label>
              <PasswordInput id="reset-confirm-password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter new password" />
              {confirmPassword.length > 0 && !matchOk && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>
            <Button
              className="w-full sm:w-auto"
              disabled={!canSubmit || resetMutation.isPending}
              onClick={() => resetMutation.mutate()}
            >
              {resetMutation.isPending ? 'Resetting…' : 'Reset Password'}
            </Button>
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="rounded-full bg-emerald-500/15 p-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Your password has been reset</p>
              <p className="text-xs text-muted-foreground">Use your new password the next time you sign in.</p>
            </div>
            <Button className="w-full sm:w-auto" onClick={() => handleClose(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
