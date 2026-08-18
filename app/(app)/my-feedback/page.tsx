'use client'

import { FeedbackBoard } from '@/modules/feedback/feedback-board'
import { useAuth } from '@/lib/auth/context'

export default function MyFeedbackPage() {
  const { session } = useAuth()

  const description =
    session?.role === 'client'
      ? 'Feedback you submitted on your support cases.'
      : 'Feedback from clients on the cases you handled.'

  return <FeedbackBoard mine title="My Feedback"  />
}
