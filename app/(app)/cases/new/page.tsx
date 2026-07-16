'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { ArrowLeft, Sparkles, CheckCircle2, BookOpen, ChevronDown, ChevronUp, Upload, Paperclip, X } from 'lucide-react'
import { cn, formatBytes, PRIORITY_LABELS } from '@/lib/utils'
import { ruleTriageEngine } from '@/lib/ai/rule-triage'
import type { Priority, Client, Team, SLARule, KBArticle, Attachment } from '@/types'
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

function NewCaseForm() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const scope = { userId: session.userId, role: session.role }

  // Prefill from query params (e.g. when arriving from a Service detail page).
  const [form, setForm] = useState({
    title: searchParams.get('title') ?? '',
    description: searchParams.get('description') ?? '',
    client_id: '',
    solution_id: searchParams.get('solution') ?? '',
    team_id: '',
    priority: 'medium' as Priority,
  })
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<FileEntry[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [suggestion, setSuggestion] = useState<TriageSuggestion | null>(null)
  const [suggestionApplied, setSuggestionApplied] = useState(false)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)
  const [kbQuery, setKbQuery] = useState('')
  const [kbExpanded, setKbExpanded] = useState(false)

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

  const { data: clients } = useQuery({ queryKey: ['clients', session.userId], queryFn: () => dp.listClients(scope) })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => dp.listTeams() })
  const { data: slaRules } = useQuery({ queryKey: ['sla-rules'], queryFn: () => dp.listSLARules() })
  const { data: solutions } = useQuery({ queryKey: ['solutions'], queryFn: () => dp.listSolutions() })

  const { data: kbArticles } = useQuery({
    queryKey: ['kb-suggest-new', kbQuery],
    queryFn: () => dp.listKBArticles({ status: 'published', search: kbQuery }),
    enabled: kbQuery.length >= 10,
    staleTime: 10_000,
  })

  useEffect(() => {
    if (form.description.length < 20 || !teams?.length) { setSuggestion(null); return }
    const t = setTimeout(() => {
      const s = ruleTriageEngine.suggest(form.title, form.description, teams)
      setSuggestion(s)
      setSuggestionApplied(false)
    }, 600)
    return () => clearTimeout(t)
  }, [form.title, form.description, teams])

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
          solution_id: form.solution_id,
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
      router.push(`/cases/${c.id}`)
    },
    onError: () => toast({ title: 'Failed to create case', variant: 'destructive' }),
  })

  const isValid = form.title && form.description && form.solution_id &&
    (session.role === 'client' || form.client_id)

  const showSuggestion = !!suggestion && !suggestionDismissed

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div>
        <h1 className="text-2xl font-bold">New Support Case</h1>
        <p className="text-sm text-muted-foreground">Fill in the details below to submit a case.</p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
          <Input
            id="title"
            placeholder="Brief description of the issue"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="desc">Description <span className="text-destructive">*</span></Label>
          <Textarea
            id="desc"
            placeholder="Describe the issue in detail..."
            rows={5}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        {/* KB Auto-suggest */}
        {suggestedKBArticles.length > 0 && (
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-2">
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
          <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-3 space-y-2">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Priority <span className="text-destructive">*</span></Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(PRIORITY_LABELS) as [Priority, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Solution <span className="text-destructive">*</span></Label>
            {/* A real solution id (not free text) — service-based routing matches
                it against each team's solution_ids to pick the approving lead. */}
            <Select value={form.solution_id} onValueChange={(v) => setForm({ ...form, solution_id: v })}>
              <SelectTrigger aria-label="Solution"><SelectValue placeholder="Select the solution / service" /></SelectTrigger>
              <SelectContent>
                {(solutions ?? []).filter((s) => s.is_active).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {session.role !== 'client' && (
            <>
              <div className="space-y-1.5">
                <Label>Client <span className="text-destructive">*</span></Label>
                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {(clients ?? []).map((c: Client) => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Team <span className="text-destructive">*</span></Label>
                <Select value={form.team_id} onValueChange={(v) => setForm({ ...form, team_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                  <SelectContent>
                    {(teams ?? []).map((t: Team) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        {/* Notes / Comment */}
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes / Comment</Label>
          <Textarea
            id="notes"
            placeholder="Add an initial note or comment for this case (optional)…"
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
              'flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-4 cursor-pointer transition-colors text-center',
              dragging ? 'border-primary bg-primary/5' : 'bg-muted/30 hover:bg-muted/50'
            )}
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
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

        <Button
          className="w-full"
          disabled={!isValid || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? 'Creating…' : 'Submit Case'}
        </Button>
      </div>
    </div>
  )
}

export default function NewCasePage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-96 rounded-xl bg-muted animate-pulse" /></div>}>
      <NewCaseForm />
    </Suspense>
  )
}