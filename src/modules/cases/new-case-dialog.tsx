'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/shared/searchable-select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import {
  Sparkles, CheckCircle2, BookOpen, ChevronDown, ChevronUp, Upload, Paperclip, X,
  Building2, Package, LifeBuoy, FileText, Send,
} from 'lucide-react'
import { cn, formatBytes, PRIORITY_LABELS, PRIORITY_COLORS } from '@/lib/utils'
import { ruleTriageEngine } from '@/lib/ai/rule-triage'
import type { Priority, Solution, SLARule, KBArticle, Attachment } from '@/types'
import type { TriageSuggestion } from '@/lib/ai/triage'

interface FileEntry { file: File; name: string; size: number; type: string }

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'txt', 'log', 'csv', 'zip', 'doc', 'docx', 'xls', 'xlsx']

function validateFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) return `"${file.name}" — unsupported file type (.${ext})`
  if (file.size > MAX_SIZE) return `"${file.name}" — exceeds the ${formatBytes(MAX_SIZE)} limit`
  return null
}

export interface NewCaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional prefill, e.g. arriving from a Service detail page. `solutionName`
      is matched against the client's available products once loaded. */
  prefill?: { title?: string; description?: string; solutionName?: string }
}

const emptyForm = (prefill?: NewCaseDialogProps['prefill']) => ({
  title: prefill?.title ?? '',
  description: prefill?.description ?? '',
  client_id: '',
  solution_id: '',
  team_id: '',
  priority: 'medium' as Priority,
})

export function NewCaseDialog({ open, onOpenChange, prefill }: NewCaseDialogProps) {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [form, setForm] = useState(() => emptyForm(prefill))
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<FileEntry[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [suggestion, setSuggestion] = useState<TriageSuggestion | null>(null)
  const [suggestionApplied, setSuggestionApplied] = useState(false)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)
  const [kbQuery, setKbQuery] = useState('')
  const [kbExpanded, setKbExpanded] = useState(false)

  // Fresh form every time the dialog opens — adjusted during render (not an
  // effect) by comparing against the last seen `open` value, per React's own
  // "resetting state when a prop changes" pattern.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setForm(emptyForm(prefill))
      setNotes('')
      setFiles([])
      setSuggestion(null)
      setSuggestionApplied(false)
      setSuggestionDismissed(false)
      setKbQuery('')
      setKbExpanded(false)
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const accepted: FileEntry[] = []
    for (const f of Array.from(fileList)) {
      const err = validateFile(f)
      if (err) toast({ title: 'Invalid file', description: err, variant: 'destructive' })
      else accepted.push({ file: f, name: f.name, size: f.size, type: f.type || 'application/octet-stream' })
    }
    if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted].slice(0, 10))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const { data: clients } = useQuery({ queryKey: ['clients', session.userId], queryFn: () => dp.listClients(scope), enabled: open })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams(), enabled: open })
  const { data: slaRules } = useQuery({ queryKey: ['sla-rules'], queryFn: () => dp.listSLARules(), enabled: open })
  const { data: solutions } = useQuery({ queryKey: ['solutions'], queryFn: () => dp.listSolutions(), enabled: open })

  // The client the case is for — the logged-in client themself, or whichever
  // client staff picked. The product/engagement picker below is scoped to it.
  const effectiveClientId = session.role === 'client' ? clients?.[0]?.id : form.client_id

  const { data: clientSolutions } = useQuery({
    queryKey: ['client-solutions', effectiveClientId],
    queryFn: () => dp.listClientSolutions(effectiveClientId),
    enabled: open && !!effectiveClientId,
  })
  const availableSolutions: Solution[] = (clientSolutions ?? []).flatMap((cs) => {
    const s = (solutions ?? []).find((x) => x.id === cs.solution_id)
    return s ? [s] : []
  })

  // Resolve a `solutionName` prefill (e.g. from a Service detail page) to a
  // real solution id once the client's available products have loaded —
  // computed at render time rather than mirrored into state.
  const prefilledSolutionId = prefill?.solutionName
    ? availableSolutions.find((s) => s.name === prefill.solutionName)?.id
    : undefined
  const selectedSolutionId = form.solution_id || prefilledSolutionId || ''

  const { data: kbArticles } = useQuery({
    queryKey: ['kb-suggest-new', kbQuery],
    queryFn: () => dp.listKBArticles({ status: 'published', search: kbQuery }),
    enabled: open && kbQuery.length >= 10,
    staleTime: 10_000,
  })

  useEffect(() => {
    if (!open || form.description.length < 20 || !teams?.length) { setSuggestion(null); return }
    const t = setTimeout(() => {
      const s = ruleTriageEngine.suggest(form.title, form.description, teams)
      setSuggestion(s)
      setSuggestionApplied(false)
    }, 600)
    return () => clearTimeout(t)
  }, [open, form.title, form.description, teams])

  // Debounce KB query from description
  useEffect(() => {
    if (form.description.length < 10) { setKbQuery(''); return }
    const t = setTimeout(() => setKbQuery(form.description.slice(0, 120)), 500)
    return () => clearTimeout(t)
  }, [form.description])

  const suggestedKBArticles = (kbArticles ?? []).filter((a: KBArticle) => a.status === 'published').slice(0, 3)

  function applyTriage() {
    if (!suggestion) return
    setForm((f) => ({ ...f, priority: suggestion.priority, team_id: suggestion.team_id }))
    setSuggestionApplied(true)
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const slaRule = (slaRules ?? []).find((r: SLARule) => r.priority === form.priority)
      const slaDueAt = slaRule
        ? new Date(Date.now() + slaRule.resolution_time_minutes * 60_000).toISOString()
        : new Date(Date.now() + 24 * 3_600_000).toISOString()

      const clientId = session.role === 'client'
        ? (clients ?? [])[0]?.id ?? ''
        : form.client_id

      const teamId = form.team_id || teams?.[0]?.id || 't1'

      const newCase = await dp.createCase(
        {
          title: form.title,
          description: form.description,
          client_id: clientId,
          solution_id: selectedSolutionId,
          team_id: teamId,
          priority: form.priority,
          status: 'new',
          sla_rule_id: slaRule?.id ?? 'sla2',
          sla_due_at: slaDueAt,
          escalation_level: 0,
          is_escalated: false,
        },
        scope
      )

      if (suggestion) {
        await dp.writeAuditLog({
          actor_id: scope.userId,
          action: 'create',
          entity_type: 'ai_triage',
          entity_id: newCase.id,
          before: { suggested_team: suggestion.team_id, suggested_priority: suggestion.priority },
          after: { applied_team: teamId, applied_priority: form.priority, accepted: suggestionApplied },
        })
      }

      // Optional opening note/comment
      if (notes.trim()) {
        await dp.addComment(
          { case_id: newCase.id, author_id: session.userId, body: notes.trim(), is_internal: false },
          scope,
        )
      }

      // Optional attachments — object URLs keep files downloadable for the session.
      await Promise.all(
        files.map((f) =>
          dp.addAttachment({
            case_id: newCase.id,
            uploaded_by: session.userId,
            file_url: URL.createObjectURL(f.file),
            file_name: f.name,
            file_type: f.type,
            category: 'attachment',
            size: f.size,
          } as Omit<Attachment, 'id' | 'created_at'>)
        )
      )

      return newCase
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['cases'] })
      toast({ title: `Case ${c.reference_no} created`, variant: 'success' })
      onOpenChange(false)
      router.push(`/cases/${c.id}`)
    },
    onError: () => toast({ title: 'Failed to create case', variant: 'destructive' }),
  })

  const isValid = form.title && form.description && selectedSolutionId &&
    (session.role === 'client' || form.client_id)

  const showSuggestion = !!suggestion && !suggestionDismissed

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="relative overflow-hidden rounded-t-lg bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 pb-4">
          <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
          <DialogHeader className="relative">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/15 ring-1 ring-primary/20 p-3 shrink-0">
                <LifeBuoy className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">Raise a Case</DialogTitle>
                <DialogDescription className="mt-0.5">We&apos;ll route it to the right NHQ team automatically.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-5 p-5 pt-4">
          {/* Client & Product */}
          <div className="space-y-4">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Client &amp; Product
            </h2>

            {session.role !== 'client' && (
              <SearchableSelect
                label="Client"
                required
                icon={Building2}
                options={(clients ?? []).map((c) => ({ id: c.id, label: c.company_name }))}
                value={form.client_id}
                onChange={(v) => setForm((f) => ({ ...f, client_id: v, solution_id: '' }))}
                placeholder="Select a client…"
                searchPlaceholder="Search clients…"
              />
            )}

            <SearchableSelect
              label="Product / Engagement"
              required
              icon={Package}
              options={availableSolutions.filter((s) => s.is_active).map((s) => ({ id: s.id, label: s.name }))}
              value={selectedSolutionId}
              onChange={(v) => setForm({ ...form, solution_id: v })}
              placeholder={effectiveClientId ? 'Select a product…' : 'Select a client first'}
              searchPlaceholder="Search products…"
            />
          </div>

          {/* Case details */}
          <div className="space-y-4">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Case Details
            </h2>

            <div className="space-y-1.5">
              <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                placeholder="e.g. Falcon sensors offline after OS patch"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => {
                  const selected = form.priority === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm({ ...form, priority: p })}
                      className={cn(
                        'rounded-lg border py-2 text-sm font-medium text-center transition-all',
                        selected
                          ? cn(PRIORITY_COLORS[p], 'border-transparent shadow-sm scale-[1.03]')
                          : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'
                      )}
                    >
                      {PRIORITY_LABELS[p]}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc">Describe the issue <span className="text-destructive">*</span></Label>
              <Textarea
                id="desc"
                placeholder="What's happening, when it started, how many users or endpoints are affected…"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {/* KB Auto-suggest */}
            {suggestedKBArticles.length > 0 && (
              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-2">
                <button
                  type="button"
                  className="flex items-center gap-1.5 w-full text-left"
                  onClick={() => setKbExpanded((v) => !v)}
                >
                  <BookOpen className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex-1">
                    {suggestedKBArticles.length} KB article{suggestedKBArticles.length > 1 ? 's' : ''} may help
                  </span>
                  {kbExpanded
                    ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                    : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                </button>
                {kbExpanded && (
                  <ul className="space-y-1.5 mt-1">
                    {suggestedKBArticles.map((a: KBArticle) => (
                      <li key={a.id} className="text-xs text-foreground flex flex-col gap-0.5">
                        <span className="font-medium">{a.title}</span>
                        {a.body && <span className="text-muted-foreground line-clamp-2">{a.body}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* AI Triage Suggestion */}
            {showSuggestion && (
              <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                  <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">AI Smart Triage</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{Math.round(suggestion.confidence * 100)}% confidence</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-foreground">
                  <span>Team → <span className="font-semibold">{suggestion.team_name}</span></span>
                  <span>Priority → <span className={cn('font-semibold capitalize', suggestion.priority === 'critical' ? 'text-red-600' : suggestion.priority === 'high' ? 'text-amber-600' : '')}>{suggestion.priority}</span></span>
                </div>
                <p className="text-[11px] text-muted-foreground italic">{suggestion.reasoning}</p>
                <div className="flex gap-2">
                  {!suggestionApplied ? (
                    <Button type="button" size="sm" variant="outline" className="h-6 text-[11px]" onClick={applyTriage}>
                      Apply suggestions
                    </Button>
                  ) : (
                    <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Applied
                    </span>
                  )}
                  <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px] text-muted-foreground" onClick={() => setSuggestionDismissed(true)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Additional details */}
          <div className="space-y-4">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" /> Additional Details
            </h2>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Supporting information</Label>
              <Textarea
                id="notes"
                placeholder="Steps already tried, workarounds, environment details, error codes…"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label>Attachments <span className="text-xs text-muted-foreground font-normal">(optional, up to 10)</span></Label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-5 cursor-pointer transition-all text-center',
                  dragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/40'
                )}
              >
                <div className="rounded-full bg-primary/10 p-2.5">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Click to upload</span> or drag and drop
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Images, PDF, documents, archives · up to {formatBytes(MAX_SIZE)}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.log,.csv,.zip,.doc,.docx,.xls,.xlsx"
                  className="sr-only"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>
              {files.length > 0 && (
                <ul className="space-y-1">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs rounded-md bg-muted/40 px-2.5 py-1.5">
                      <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-muted-foreground shrink-0">{formatBytes(f.size)}</span>
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="p-5 pt-0 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!isValid || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <Send className="h-3.5 w-3.5" />
            {createMutation.isPending ? 'Submitting…' : `Submit ${form.priority} case`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
