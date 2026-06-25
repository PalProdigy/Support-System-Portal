'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { Paperclip, X, Upload, Sparkles, BookOpen, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { formatBytes, cn } from '@/lib/utils'
import { ruleTriageEngine } from '@/lib/ai/rule-triage'
import type { Solution, Priority, Attachment, KBArticle } from '@/types'
import type { TriageSuggestion } from '@/lib/ai/triage'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  solution: Solution | null
}

interface FileEntry { file: File; name: string; size: number; type: string }

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

const INITIAL_FORM = { title: '', description: '', priority: 'medium' as Priority }

export function CreateCaseDialog({ open, onOpenChange, solution }: Props) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const [form, setForm] = useState(INITIAL_FORM)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [suggestion, setSuggestion] = useState<TriageSuggestion | null>(null)
  const [suggestionApplied, setSuggestionApplied] = useState(false)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)
  const [kbQuery, setKbQuery] = useState('')
  const [kbExpanded, setKbExpanded] = useState(false)
  const [deflected, setDeflected] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(INITIAL_FORM)
      setFiles([])
      setSelectedTeamId('')
      setSuggestion(null)
      setSuggestionApplied(false)
      setSuggestionDismissed(false)
      setKbQuery('')
      setKbExpanded(false)
      setDeflected(false)
    }
  }, [open])

  const { data: clients } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
    enabled: open,
  })
  const { data: slaRules } = useQuery({
    queryKey: ['sla-rules'],
    queryFn: () => dp.listSLARules(),
    enabled: open,
  })
  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => dp.listTeams(),
    enabled: open,
  })
  const { data: kbArticles } = useQuery({
    queryKey: ['kb-suggest', kbQuery],
    queryFn: () => dp.listKBArticles({ status: 'published', search: kbQuery }),
    enabled: kbQuery.length >= 10,
    staleTime: 10_000,
  })

  // Debounce KB query from description
  useEffect(() => {
    if (form.description.length < 10) { setKbQuery(''); return }
    const t = setTimeout(() => setKbQuery(form.description.slice(0, 120)), 500)
    return () => clearTimeout(t)
  }, [form.description])

  // Debounce AI triage suggestion
  useEffect(() => {
    if (form.description.length < 20 || !teams?.length) { setSuggestion(null); return }
    const t = setTimeout(() => {
      const s = ruleTriageEngine.suggest(form.title, form.description, teams)
      setSuggestion(s)
      setSuggestionApplied(false)
    }, 600)
    return () => clearTimeout(t)
  }, [form.title, form.description, teams])

  // Initialise selectedTeamId from teams when loaded
  useEffect(() => {
    if (teams?.length && !selectedTeamId) setSelectedTeamId(teams[0].id)
  }, [teams, selectedTeamId])

  const clientId = clients?.[0]?.id

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!clientId || !solution) throw new Error('Missing client or solution')
      const slaRule = (slaRules ?? []).find((r) => r.priority === form.priority)
      const dueAt = slaRule
        ? new Date(Date.now() + slaRule.resolution_time_minutes * 60_000).toISOString()
        : new Date(Date.now() + 72 * 3_600_000).toISOString()

      const teamId = selectedTeamId || teams?.[0]?.id || 't1'

      const newCase = await dp.createCase(
        {
          title: form.title.trim(),
          description: form.description.trim(),
          priority: form.priority,
          status: 'new',
          client_id: clientId,
          solution_id: solution.id,
          team_id: teamId,
          sla_rule_id: slaRule?.id ?? '',
          sla_due_at: dueAt,
          escalation_level: 0,
          is_escalated: false,
        },
        scope,
      )

      // Audit: record AI triage suggestion and whether it was applied
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

      await Promise.all(
        files.map((f) =>
          dp.addAttachment({
            case_id: newCase.id,
            uploaded_by: session.userId,
            file_url: `mock://uploads/${newCase.id}/${f.name}`,
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
      toast({ title: 'Case created', description: `${c.reference_no} — ${c.title}`, variant: 'success' })
      onOpenChange(false)
      router.push(`/client/cases/${c.id}`)
    },
    onError: () => toast({ title: 'Failed to create case', variant: 'destructive' }),
  })

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    setFiles((prev) => [
      ...prev,
      ...Array.from(fileList).map((f) => ({ file: f, name: f.name, size: f.size, type: f.type || 'application/octet-stream' })),
    ].slice(0, 5))
  }

  function applyTriage() {
    if (!suggestion) return
    setForm((f) => ({ ...f, priority: suggestion.priority }))
    setSelectedTeamId(suggestion.team_id)
    setSuggestionApplied(true)
  }

  const suggestedArticles = (kbArticles ?? []).filter((a: KBArticle) => a.status === 'published').slice(0, 3)
  const showKb = suggestedArticles.length > 0 && !deflected
  const showSuggestion = !!suggestion && !suggestionDismissed

  const valid = form.title.trim().length >= 3 && form.description.trim().length >= 10

  if (deflected) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <div>
              <p className="font-semibold text-foreground">Great, glad that helped!</p>
              <p className="text-sm text-muted-foreground mt-1">No case has been created. Come back if the issue persists.</p>
            </div>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Create Case
            {solution && <span className="text-muted-foreground font-normal text-sm ml-1">· {solution.name}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              placeholder="Brief summary of the issue"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
            <Textarea
              id="description"
              rows={4}
              placeholder="Describe the issue in detail: what happened, steps to reproduce, expected vs actual..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* KB Auto-Suggest */}
          {showKb && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 p-3 space-y-2">
              <button
                type="button"
                className="flex w-full items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300"
                onClick={() => setKbExpanded((x) => !x)}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>These articles might solve your issue</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-normal">{kbExpanded ? 'hide' : 'show'}</span>
                {kbExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>

              {kbExpanded && (
                <div className="space-y-2">
                  {suggestedArticles.map((a: KBArticle) => (
                    <div key={a.id} className="rounded-md bg-white dark:bg-background border border-blue-100 dark:border-blue-900 p-2.5 space-y-1">
                      <p className="text-xs font-medium text-foreground">{a.title}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{a.body.slice(0, 150)}…</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 text-[11px] text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700"
                        onClick={() => setDeflected(true)}
                      >
                        <CheckCircle2 className="h-3 w-3" /> This solved my issue
                      </Button>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground">If none of these helped, continue filling out the form below.</p>
                </div>
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
                <span>Priority → <span className={cn('font-semibold capitalize', suggestion.priority === 'critical' ? 'text-red-600' : suggestion.priority === 'high' ? 'text-amber-600' : 'text-foreground')}>{suggestion.priority}</span></span>
              </div>
              <p className="text-[11px] text-muted-foreground italic">{suggestion.reasoning}</p>
              <div className="flex gap-2">
                {!suggestionApplied ? (
                  <Button type="button" size="sm" variant="outline" className="h-6 text-[11px]" onClick={applyTriage}>
                    Apply suggestions
                  </Button>
                ) : (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Applied
                  </span>
                )}
                <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px] text-muted-foreground" onClick={() => setSuggestionDismissed(true)}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <Label>Attachments <span className="text-xs text-muted-foreground">(optional, up to 5)</span></Label>
            <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 p-4 cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
              <Upload className="h-4 w-4" />
              <span>Click to select files (screenshots, logs, etc.)</span>
              <input type="file" multiple className="sr-only" accept="image/*,.pdf,.txt,.log,.csv,.zip" onChange={(e) => handleFiles(e.target.files)} />
            </label>
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs rounded-md bg-muted/40 px-2.5 py-1.5">
                    <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-muted-foreground shrink-0">{formatBytes(f.size)}</span>
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!valid || createMutation.isPending}>
            {createMutation.isPending ? 'Submitting…' : 'Submit Case'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
