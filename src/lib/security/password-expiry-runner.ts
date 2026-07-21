import { getDataProvider } from '@/lib/data'

const SETTINGS_KEY = 'nhq_system_settings'
const NOTIFIED_KEY = 'nhq_password_expiry_notified'

// Fire a reminder this many days before the expiration date.
const THRESHOLD_DAYS = [20, 10, 5, 1] as const

interface SystemSettingsShape {
  password_expiration_date?: string | null
}

interface NotifiedRecord {
  expiration_date: string
  thresholds: number[]
}

function readJSON<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJSON<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

// Whole-day difference between the expiration date and local midnight today.
function daysUntil(dateKey: string): number {
  const target = new Date(`${dateKey}T00:00:00`)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - startOfToday.getTime()) / 86_400_000)
}

// Serializes concurrent calls within this tab (e.g. React StrictMode's
// double-invoked effects in dev) so two checks can't both read the same
// "not yet notified" state and double-send before either finishes writing it.
let checkInFlight = false

// Checks the configured password-expiration date and, the first time the
// remaining days drop to or below each of THRESHOLD_DAYS, notifies every
// active (non-client) user to change their password before it expires.
// Safe to call repeatedly — already-sent thresholds are tracked in
// localStorage and reset automatically whenever the expiration date changes.
export async function runPasswordExpiryCheck(): Promise<{ notified: boolean }> {
  if (typeof window === 'undefined') return { notified: false }
  if (checkInFlight) return { notified: false }

  const settings = readJSON<SystemSettingsShape>(SETTINGS_KEY)
  const expirationDate = settings?.password_expiration_date
  if (!expirationDate) return { notified: false }

  let notified = readJSON<NotifiedRecord>(NOTIFIED_KEY)
  if (!notified || notified.expiration_date !== expirationDate) {
    notified = { expiration_date: expirationDate, thresholds: [] }
  }

  const remaining = daysUntil(expirationDate)
  if (remaining < 0) return { notified: false }

  const dueThresholds = THRESHOLD_DAYS.filter(
    (t) => remaining <= t && !notified!.thresholds.includes(t)
  )
  if (dueThresholds.length === 0) return { notified: false }

  checkInFlight = true
  // Claim these thresholds before the first `await` so a concurrent call
  // sees them as already handled instead of racing to resend them.
  writeJSON(NOTIFIED_KEY, { expiration_date: expirationDate, thresholds: [...notified.thresholds, ...dueThresholds] })

  try {
    const dp = getDataProvider()
    const users = await dp.listUsers()
    const recipients = users.filter((u) => u.is_active && u.role !== 'client')
    const formatted = new Date(`${expirationDate}T00:00:00`).toLocaleDateString('en-GB')
    const message = remaining === 0
      ? `Your password expires today (${formatted}). Please change it now.`
      : `Your password will expire in ${remaining} day${remaining === 1 ? '' : 's'} (${formatted}). Please change it before then.`

    await Promise.all(
      recipients.map((u) =>
        dp.createNotification({
          user_id: u.id,
          channel: 'in_app',
          type: 'password_expiration_reminder',
          payload: { message, expiration_date: expirationDate, days_remaining: remaining },
          sent_at: new Date().toISOString(),
        })
      )
    )
    return { notified: true }
  } finally {
    checkInFlight = false
  }
}
