import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Award, Briefcase } from 'lucide-react'
import type { CertificationLevel } from '@/types'

// Colour tiers for the certification level badge (L1 junior → L5 expert) —
// shared across every staff dashboard (engineer, AM, ...) for visual consistency.
export const CERT_COLORS: Record<CertificationLevel, string> = {
  L1: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-600',
  L2: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-700',
  L3: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/40 dark:text-violet-400 dark:border-violet-700',
  L4: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700',
  L5: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-700',
}
export const CERT_LABELS: Record<CertificationLevel, string> = {
  L1: 'Foundation', L2: 'Associate', L3: 'Professional', L4: 'Senior', L5: 'Expert',
}

export function CertificationCard({ level, years }: { level?: CertificationLevel; years?: number }) {
  return (
    <div className="h-full rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">Certification</p>
          <div className="mt-1">
            {level ? (
              <Badge variant="outline" className={cn('font-mono font-bold gap-1', CERT_COLORS[level])}>
                <Award className="h-3 w-3" /> {level}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Briefcase className="h-3 w-3" /> Uncertified
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-snug truncate">
            {level ? CERT_LABELS[level] : 'Not yet certified'}
            {years != null && ` · ${years} yr${years === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
          <Award className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  )
}
