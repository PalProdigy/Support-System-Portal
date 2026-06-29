'use client'

import { FeedbackBoard } from '@/modules/feedback/feedback-board'

export default function MyFeedbackPage() {
  return (
    <FeedbackBoard
      mine
      title="My Feedback"
      description="Feedback from clients on the cases you handled."
    />
  )
}