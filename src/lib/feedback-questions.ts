export interface FeedbackQuestion {
  key: string
  label: string
}

export const FEEDBACK_QUESTIONS: FeedbackQuestion[] = [
  { key: 'response_time', label: 'How quickly did our team respond once you reported the issue?' },
  { key: 'technical_expertise', label: 'How would you rate the technical expertise of the engineer who handled your case?' },
  { key: 'communication', label: 'How clear and easy to understand was our communication throughout the process?' },
  { key: 'problem_resolution', label: 'How effectively was the underlying problem actually resolved?' },
  { key: 'professionalism', label: 'How professional and courteous was the team in their interactions with you?' },
  { key: 'follow_up', label: 'How satisfied were you with the follow-up after the initial fix was applied?' },
  { key: 'understanding_issue', label: 'How well did our team understand the specific issue you were facing?' },
  { key: 'documentation', label: 'How clear and useful were the instructions or documentation provided?' },
  { key: 'overall_experience', label: 'Overall, how would you rate your experience with our support team?' },
  { key: 'recommend', label: 'How likely are you to recommend our support service to a colleague?' },
]

// The feedback's overall star rating isn't picked directly — it's decided by
// averaging the 10 individual question scores.
export function computeOverallRating(ratings: Record<string, number>): number {
  const values = Object.values(ratings).filter((v) => v > 0)
  if (values.length === 0) return 0
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
}
