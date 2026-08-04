'use client'

const RATING_LABELS: Record<number, string> = {
  1: 'Poor', 2: 'Below Average', 3: 'Satisfactory', 4: 'Good', 5: 'Excellent',
}

function gaugeColor(rating: number): string {
  if (rating >= 4) return '#10b981' // emerald-500
  if (rating >= 3) return '#f59e0b' // amber-500
  return '#ef4444' // red-500
}

export function RatingGauge({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100))
  const color = rating > 0 ? gaugeColor(rating) : undefined
  const dim = size === 'sm' ? 56 : 72
  const inset = size === 'sm' ? 4 : 5

  return (
    <div className="flex items-center gap-3">
      <div
        className="relative shrink-0 rounded-full"
        style={{
          width: dim,
          height: dim,
          background: rating > 0
            ? `conic-gradient(${color} ${pct}%, hsl(var(--muted)) ${pct}%)`
            : 'hsl(var(--muted))',
        }}
      >
        <div
          className="absolute rounded-full bg-card flex items-center justify-center"
          style={{ inset }}
        >
          <span className={size === 'sm' ? 'text-base font-bold text-foreground' : 'text-lg font-bold text-foreground'}>
            {rating > 0 ? rating : '—'}
          </span>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Overall Rating</p>
        {rating > 0 ? (
          <p className="text-sm font-semibold mt-0.5" style={{ color }}>{RATING_LABELS[Math.round(rating)]}</p>
        ) : (
          <p className="text-sm text-muted-foreground mt-0.5">Awaiting answers</p>
        )}
      </div>
    </div>
  )
}
