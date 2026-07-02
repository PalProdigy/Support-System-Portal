import type { Team, Priority } from '@/types'

export interface TriageSuggestion {
  team_id: string
  team_name: string
  priority: Priority
  confidence: number // 0–1
  reasoning: string
}

export interface AITriageEngine {
  suggest(title: string, description: string, teams: Team[]): TriageSuggestion | null
}