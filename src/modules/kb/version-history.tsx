'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { cn, formatDateTime } from '@/lib/utils'
import { History, RotateCcw, ChevronLeft } from 'lucide-react'
import type { KBArticle, KBArticleVersion } from '@/types'

// ── Minimal line diff (LCS) — good enough for markdown documents ─────────────
type DiffLine = { kind: 'same' | 'added' | 'removed'; text: string }

function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split('\n')
  const b = newText.split('\n')
  // LCS table (docs are small; O(n·m) is fine — guard very large inputs)
  if (a.length * b.length > 400_000) {
    return [
      ...a.map((text): DiffLine => ({ kind: 'removed', text })),
      ...b.map((text): DiffLine => ({ kind: 'added', text })),
    ]
  }
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: DiffLine[] = []
  let i = 0, j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push({ kind: 'same', text: a[i] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ kind: 'removed', text: a[i] }); i++ }
    else { out.push({ kind: 'added', text: b[j] }); j++ }
  }
  while (i < a.length) out.push({ kind: 'removed', text: a[i++] })
  while (j < b.length) out.push({ kind: 'added', text: b[j++] })
  return out
}

// Collapse long unchanged runs so the diff stays scannable.
function collapseSame(lines: DiffLine[], context = 2): (DiffLine | { kind: 'skip'; count: number })[] {
  const out: (DiffLine | { kind: 'skip'; count: number })[] = []
  let run: DiffLine[] = []
  const flush = (isEdge: boolean) => {
    if (run.length <= context * 2 + 1 || isEdge && run.length <= context + 1) { out.push(...run) }
    else {
      out.push(...run.slice(0, context))
      out.push({ kind: 'skip', count: run.length - context * 2 })
      out.push(...run.slice(-context))
    }
    run = []
  }
  for (const l of lines) {
    if (l.kind === 'same') run.push(l)
    else { flush(false); out.push(l) }
  }
  flush(true)
  return out
}

export interface VersionHistoryProps {
  article: KBArticle
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Whether the current user may restore old versions (author or reviewer). */
  canRestore: boolean
}

/**
 * Version history dialog: every content edit snapshots the previous state.
 * Selecting a version shows a line diff against the current article and
 * (optionally) lets the user restore it — which itself creates a new version.
 */
export function VersionHistory({ article, open, onOpenChange, canRestore }: VersionHistoryProps) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<KBArticleVersion | null>(null)

  const versions = useMemo(() => [...(article.versions ?? [])].reverse(), [article.versions])

  const restore = useMutation({
    mutationFn: (version: number) =>
      dp.restoreKBVersion(article.id, version, { userId: session.userId, role: session.role }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['kb'] })
      toast({ title: `Restored version ${selected?.version}`, description: `Now saved as version ${updated.version}`, variant: 'success' })
      setSelected(null)
      onOpenChange(false)
    },
    onError: (e) => toast({ title: String(e), variant: 'destructive' }),
  })

  const diff = useMemo(
    () => (selected ? collapseSame(diffLines(selected.body, article.body)) : []),
    [selected, article.body],
  )

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setSelected(null); onOpenChange(o) }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {selected ? `Version ${selected.version} → current (v${article.version ?? 1})` : 'Version history'}
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          <div className="space-y-2 overflow-y-auto">
            {/* Current version row */}
            <div className="rounded-lg border bg-muted/40 p-3 flex items-center gap-3">
              <span className="font-mono text-xs font-bold text-primary shrink-0">v{article.version ?? 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{article.title}</p>
                <p className="text-xs text-muted-foreground">Current version · {formatDateTime(article.updated_at)}</p>
              </div>
            </div>
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No previous versions yet — each saved edit creates one.
              </p>
            ) : (
              versions.map((v) => (
                <button
                  key={v.version}
                  type="button"
                  onClick={() => setSelected(v)}
                  className="w-full rounded-lg border bg-card p-3 flex items-center gap-3 text-left hover:bg-accent/40 transition-colors"
                >
                  <span className="font-mono text-xs font-bold text-muted-foreground shrink-0">v{v.version}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{v.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.saved_by_name ?? v.saved_by} · {formatDateTime(v.saved_at)}
                    </p>
                  </div>
                  <span className="text-xs text-primary shrink-0">Compare</span>
                </button>
              ))
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                <ChevronLeft className="h-4 w-4" /> All versions
              </Button>
              {canRestore && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate(selected.version)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {restore.isPending ? 'Restoring…' : `Restore v${selected.version}`}
                </Button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-muted/20 font-mono text-xs leading-relaxed">
              {diff.map((l, i) =>
                l.kind === 'skip' ? (
                  <p key={i} className="px-3 py-1 text-center text-muted-foreground/70 select-none">⋯ {l.count} unchanged lines ⋯</p>
                ) : (
                  <p
                    key={i}
                    className={cn(
                      'px-3 whitespace-pre-wrap break-words',
                      l.kind === 'added' && 'bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200',
                      l.kind === 'removed' && 'bg-red-100/70 dark:bg-red-950/40 text-red-900 dark:text-red-300 line-through decoration-red-400/60',
                    )}
                  >
                    <span className="select-none mr-2 text-muted-foreground/60">{l.kind === 'added' ? '+' : l.kind === 'removed' ? '−' : ' '}</span>
                    {l.text || ' '}
                  </p>
                ),
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              <span className="text-emerald-600 dark:text-emerald-400">+ green</span> lines exist only in the current version;{' '}
              <span className="text-red-600 dark:text-red-400">− red</span> lines exist only in v{selected.version}.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
