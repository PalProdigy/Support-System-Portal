'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { FileSearch, Save } from 'lucide-react'

interface Props { caseId: string }

const FIELDS: { key: keyof RCAForm; label: string; placeholder: string }[] = [
  { key: 'problem', label: 'Problem Statement', placeholder: 'What was the reported problem and its impact?' },
  { key: 'root_cause', label: 'Root Cause', placeholder: 'What caused this issue to occur?' },
  { key: 'resolution', label: 'Resolution Applied', placeholder: 'What steps were taken to resolve it?' },
  { key: 'prevention', label: 'Prevention Measures', placeholder: 'How can we prevent this from recurring?' },
]

interface RCAForm { problem: string; root_cause: string; resolution: string; prevention: string }
const EMPTY: RCAForm = { problem: '', root_cause: '', resolution: '', prevention: '' }

export function RCAForm({ caseId }: Props) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()

  const [form, setForm] = useState<RCAForm>(EMPTY)
  const [dirty, setDirty] = useState(false)

  const { data: existing } = useQuery({
    queryKey: ['rca', caseId],
    queryFn: () => dp.getRCA(caseId),
  })

  useEffect(() => {
    if (existing) {
      setForm({ problem: existing.problem, root_cause: existing.root_cause, resolution: existing.resolution, prevention: existing.prevention })
      setDirty(false)
    }
  }, [existing])

  const saveMutation = useMutation({
    mutationFn: () => dp.upsertRCA({
      case_id: caseId,
      created_by: session.userId,
      ...form,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rca', caseId] })
      toast({ title: 'RCA saved', variant: 'success' })
      setDirty(false)
    },
    onError: () => toast({ title: 'Failed to save RCA', variant: 'destructive' }),
  })

  const allFilled = Object.values(form).every((v) => v.trim().length >= 10)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileSearch className="h-4 w-4" />
        <span>Root Cause Analysis — complete all 4 fields before resolving</span>
      </div>

      {FIELDS.map(({ key, label, placeholder }) => (
        <div key={key} className="space-y-1.5">
          <Label className="text-sm font-semibold">{label}</Label>
          <Textarea
            rows={3}
            placeholder={placeholder}
            value={form[key]}
            onChange={(e) => {
              setForm((f) => ({ ...f, [key]: e.target.value }))
              setDirty(true)
            }}
          />
        </div>
      ))}

      <div className="flex items-center justify-between pt-1">
        {!allFilled && (
          <p className="text-xs text-muted-foreground">All fields required (min 10 chars each)</p>
        )}
        <div className="ml-auto">
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || !allFilled || saveMutation.isPending}
          >
            <Save className="h-3.5 w-3.5" />
            {saveMutation.isPending ? 'Saving…' : existing ? 'Update RCA' : 'Save RCA'}
          </Button>
        </div>
      </div>

      {existing && !dirty && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          ✓ RCA saved — last updated {new Date(existing.created_at).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}
