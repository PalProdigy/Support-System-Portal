export type Period = '12m' | '6m' | '3m' | '1m' | 'week' | 'custom'

export const PERIOD_TABS: { value: Period; label: string; title: string }[] = [
  { value: '12m',    label: '12 Months', title: 'Last 12 Months' },
  { value: '6m',     label: '6 Months',  title: 'Last 6 Months' },
  { value: '3m',     label: '3 Months',  title: 'Last 3 Months' },
  { value: '1m',     label: '1 Month',   title: 'Last 30 Days' },
  { value: 'week',   label: 'Week',      title: 'Last 7 Days' },
  { value: 'custom', label: 'Custom',    title: 'Custom Range' },
]

export interface DateBucket {
  label: string
  start: number
  end: number
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function emptyBucket(label: string, start: Date, end: Date): DateBucket {
  return { label, start: start.getTime(), end: end.getTime() }
}

function monthlyBuckets(monthsCount: number, now: Date): DateBucket[] {
  const buckets: DateBucket[] = []
  for (let i = monthsCount - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    buckets.push(emptyBucket(`${MONTH_LABELS[start.getMonth()]} ${String(start.getFullYear()).slice(2)}`, start, end))
  }
  return buckets
}

function dailyBuckets(from: Date, to: Date): DateBucket[] {
  const buckets: DateBucket[] = []
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  while (cursor.getTime() <= last.getTime()) {
    const start = new Date(cursor)
    const end = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
    buckets.push(emptyBucket(`${MONTH_LABELS[start.getMonth()]} ${start.getDate()}`, start, end))
    cursor.setDate(cursor.getDate() + 1)
  }
  return buckets
}

// Today back to the previous 6 days, labeled by weekday name (today's weekday
// shifts daily, so the labels are always relative to "now").
function weekBuckets(now: Date): DateBucket[] {
  const buckets: DateBucket[] = []
  for (let i = 6; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
    buckets.push(emptyBucket(WEEKDAY_LABELS[start.getDay()], start, end))
  }
  return buckets
}

// Custom ranges bucket by day when short enough to stay readable, otherwise by month.
function customBuckets(fromStr: string, toStr: string): DateBucket[] {
  if (!fromStr || !toStr) return []
  const from = new Date(fromStr)
  const to = new Date(toStr)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from.getTime() > to.getTime()) return []

  const daySpan = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
  if (daySpan <= 45) return dailyBuckets(from, to)

  const buckets: DateBucket[] = []
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
  const last = new Date(to.getFullYear(), to.getMonth(), 1)
  while (cursor.getTime() <= last.getTime()) {
    const start = new Date(cursor)
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    buckets.push(emptyBucket(`${MONTH_LABELS[start.getMonth()]} ${String(start.getFullYear()).slice(2)}`, start, end))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return buckets
}

export function buildDateBuckets(period: Period, customFrom: string, customTo: string, nowMs: number): DateBucket[] {
  const now = new Date(nowMs)
  if (period === '12m') return monthlyBuckets(12, now)
  if (period === '6m') return monthlyBuckets(6, now)
  if (period === '3m') return monthlyBuckets(3, now)
  if (period === '1m') {
    const from = new Date(now)
    from.setDate(from.getDate() - 29)
    return dailyBuckets(from, now)
  }
  if (period === 'week') return weekBuckets(now)
  return customBuckets(customFrom, customTo)
}