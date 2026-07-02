'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, CheckCircle2, XCircle, X } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/rbac'
import { cn } from '@/lib/utils'
import type { Solution } from '@/types'

// Fallback Type options, unioned with whatever categories already exist in the data.
const DEFAULT_TYPES = ['Integration', 'Data & Analytics', 'CRM', 'Operations', 'HR']

type Banner = { kind: 'success' | 'error'; message: string }

export default function NewSolutionPage() {
  const session = useSession()
  const dp = getDataProvider()
  const router = useRouter()
  const qc = useQueryClient()

  const [form, setForm] = useState({ title: '', type: '', description: '' })
  const [touched, setTouched] = useState(false)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [saving, setSaving] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  const { data: solutions } = useQuery({ queryKey: ['solutions'], queryFn: () => dp.listSolutions() })
  const { data: currentUser } = useQuery({ queryKey: ['user', session.userId], queryFn: () => dp.getUser(session.userId) })

  const typeOptions = useMemo(() => {
    const fromData = (solutions ?? []).map((s) => s.category).filter(Boolean)
    return Array.from(new Set([...DEFAULT_TYPES, ...fromData]))
  }, [solutions])

  // Auto-dismiss banner after a few seconds
  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 5000)
    return () => clearTimeout(t)
  }, [banner])

  const errors = {
    title: form.title.trim() ? '' : 'Title is required.',
    type: form.type.trim() ? '' : 'Type is required.',
    description: form.description.trim() ? '' : 'Description is required.',
  }
  const isValid = !errors.title && !errors.type && !errors.description

  async function handleSave() {
    setTouched(true)
    if (!isValid || saving) return

    setSaving(true)
    setBanner(null)
    try {
      const authorName = currentUser?.name ?? session.userId
      if (savedId) {
        await dp.updateSolution(savedId, {
          name: form.title.trim(),
          category: form.type,
          description: form.description.trim(),
          details: form.description.trim(),
          author_id: session.userId,
          author_name: authorName,
          author_role: session.role,
        })
      } else {
        const created = await dp.createSolution({
          name: form.title.trim(),
          category: form.type,
          description: form.description.trim(),
          details: form.description.trim(),
          is_active: true,
          author_id: session.userId,
          author_name: authorName,
          author_role: session.role,
        } as Omit<Solution, 'id' | 'created_at'>)
        setSavedId(created.id)
      }
      qc.invalidateQueries({ queryKey: ['solutions'] })
      setReadOnly(true)
      setBanner({ kind: 'success', message: 'Solution saved successfully.' })
    } catch {
      // Keep the user's entered data intact on failure
      setBanner({ kind: 'error', message: "Couldn't save the solution. Please try again." })
    } finally {
      setSaving(false)
    }
  }

  function handleEdit() {
    setReadOnly(false)
    setBanner(null)
  }

  const showError = (field: keyof typeof errors) => touched && errors[field]

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/solutions')}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div>
        <h1 className="text-2xl font-bold">Create Solution</h1>
        <p className="text-sm text-muted-foreground">Add a new product or service to the catalogue.</p>
      </div>

      {/* Result banner */}
      {banner && (
        <div
          role="status"
          className={cn(
            'flex items-start gap-2 rounded-lg border p-3 text-sm',
            banner.kind === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
              : 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300'
          )}
        >
          {banner.kind === 'success' ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{banner.message}</span>
          <button type="button" onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="rounded-xl border bg-card p-6 space-y-4">
        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
          <Input
            id="title"
            placeholder="Solution title"
            value={form.title}
            readOnly={readOnly}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          {showError('title') && <p className="text-xs text-destructive">{errors.title}</p>}
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <Label>Type <span className="text-destructive">*</span></Label>
          <Select value={form.type} disabled={readOnly} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
            <SelectContent>
              {typeOptions.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showError('type') && <p className="text-xs text-destructive">{errors.type}</p>}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="desc">Description <span className="text-destructive">*</span></Label>
          <Textarea
            id="desc"
            placeholder="Describe the solution..."
            rows={5}
            value={form.description}
            readOnly={readOnly}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          {showError('description') && <p className="text-xs text-destructive">{errors.description}</p>}
        </div>

        {/* Auto-captured metadata (read-only context) */}
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-0.5">
          <p>Author: <span className="font-medium text-foreground">{currentUser?.name ?? '—'}</span></p>
          <p>Role: <span className="font-medium text-foreground">{ROLE_LABELS[session.role] ?? session.role}</span></p>
          <p>Date: <span className="font-medium text-foreground">{new Date().toLocaleDateString()}</span></p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={!readOnly} onClick={handleEdit}>
          Edit
          </Button>
          <Button disabled={readOnly || saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save'}
          </Button>

        </div>
      </div>
    </div>
  )
}