'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Star, Plus, Send } from 'lucide-react'
import type { Case } from '@/types'

interface Props {
  /** The logged-in client's own cases (already scoped by listCases). */
  cases: Case[]
}

export function CreateFeedbackDialog({ cases }: Props) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [open, setOpen] = useState(false)
  const [caseId, setCaseId] = useState('')
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')

  const selectedCase = cases.find((c) => c.id === caseId)

  const reset = () => {
    setCaseId('')
    setRating(0)
    setText('')
  }

  const submit = useMutation({
    mutationFn: () => {
      if (!selectedCase) throw new Error('No case selected')
      return dp.submitFeedback({
        case_id: selectedCase.id,
        client_id: selectedCase.client_id,
        feedback_text: text.trim(),
        rating: rating > 0 ? rating : undefined,
      }, scope)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback'] })
      qc.invalidateQueries({ queryKey: ['cases'] })
      toast({ title: 'Feedback submitted — thank you!', variant: 'success' })
      setOpen(false)
      reset()
    },
    onError: () => toast({ title: 'Failed to submit feedback', variant: 'destructive' }),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Create Feedback
      </Button>

      <DialogContent className="max-w-md p-5">
        <DialogHeader>
          <DialogTitle>Share Feedback</DialogTitle>
          <DialogDescription>Tell us about your experience on one of your cases.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Case picker */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Case</label>
            <Select value={caseId} onValueChange={setCaseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a case…" />
              </SelectTrigger>
              <SelectContent>
                {cases.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">No cases available</div>
                ) : (
                  cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.reference_no} — {c.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Rating */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Rating</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(rating === n ? 0 : n)}
                  className="transition-transform hover:scale-110"
                >
                  <Star className={cn('h-6 w-6', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30 hover:text-amber-300')} />
                </button>
              ))}
              {rating > 0 && <span className="text-xs text-muted-foreground ml-1">{rating}/5</span>}
            </div>
          </div>

          {/* Text */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Comments</label>
            <Textarea
              rows={4}
              placeholder="How was your experience? Any comments or suggestions?"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => submit.mutate()}
            disabled={!caseId || text.trim().length === 0 || submit.isPending}
          >
            <Send className="h-3.5 w-3.5" />
            {submit.isPending ? 'Submitting…' : 'Submit Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
