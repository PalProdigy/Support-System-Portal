'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { QuestionRatingRow } from '@/components/shared/question-rating-row'
import { RatingGauge } from '@/components/shared/rating-gauge'
import { SearchableSelect } from '@/components/shared/searchable-select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { FEEDBACK_QUESTIONS, computeOverallRating } from '@/lib/feedback-questions'
import { Plus, Send, Star, Ticket, MessageSquare } from 'lucide-react'
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
  const [questionRatings, setQuestionRatings] = useState<Record<string, number>>({})
  const [text, setText] = useState('')

  const selectedCase = cases.find((c) => c.id === caseId)
  const answeredCount = FEEDBACK_QUESTIONS.filter((q) => (questionRatings[q.key] ?? 0) > 0).length
  const allAnswered = answeredCount === FEEDBACK_QUESTIONS.length
  const overallRating = computeOverallRating(questionRatings)

  const reset = () => {
    setCaseId('')
    setQuestionRatings({})
    setText('')
  }

  const submit = useMutation({
    mutationFn: () => {
      if (!selectedCase) throw new Error('No case selected')
      return dp.submitFeedback({
        case_id: selectedCase.id,
        client_id: selectedCase.client_id,
        feedback_text: text.trim(),
        rating: overallRating,
        question_ratings: questionRatings,
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

      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto p-0">
        <div className="relative overflow-hidden rounded-t-lg bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 pb-4">
          <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
          <DialogHeader className="relative">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/15 ring-1 ring-primary/20 p-3 shrink-0">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">Share Your Feedback</DialogTitle>
                <DialogDescription className="mt-0.5">Rate each aspect below — your overall score is decided from these answers.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Progress */}
          <div className="relative mt-4 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-background/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${(answeredCount / FEEDBACK_QUESTIONS.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground shrink-0">{answeredCount}/{FEEDBACK_QUESTIONS.length} answered</span>
          </div>
        </div>

        <div className="space-y-5 p-5 pt-4">
          {/* Case picker */}
          <SearchableSelect
            label="Case"
            icon={Ticket}
            options={cases.map((c) => ({ id: c.id, label: c.reference_no, sublabel: c.title }))}
            value={caseId}
            onChange={setCaseId}
            placeholder="Select a case…"
            searchPlaceholder="Search cases…"
          />

          {/* 10 rating questions */}
          <div className="space-y-2">
            {FEEDBACK_QUESTIONS.map((q, i) => (
              <QuestionRatingRow
                key={q.key}
                index={i + 1}
                label={q.label}
                value={questionRatings[q.key] ?? 0}
                onChange={(v) => setQuestionRatings((r) => ({ ...r, [q.key]: v }))}
              />
            ))}
          </div>

          {/* Overall rating summary */}
          <div className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4">
            <RatingGauge rating={overallRating} />
          </div>

          {/* Text */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5 text-muted-foreground" /> Comments</label>
            <Textarea
              rows={4}
              placeholder="How was your experience? Any comments or suggestions?"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="p-5 pt-0">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => submit.mutate()}
            disabled={!caseId || !allAnswered || text.trim().length === 0 || submit.isPending}
          >
            <Send className="h-3.5 w-3.5" />
            {submit.isPending ? 'Submitting…' : 'Submit Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
