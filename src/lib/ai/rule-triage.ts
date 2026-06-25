import type { AITriageEngine, TriageSuggestion } from './triage'
import type { Team, Priority } from '@/types'

// Domain keyword lists — configure these for real-world solutions/categories
const OPS_KEYWORDS = [
  'erp', 'integration', 'sync', 'connector', 'middleware', 'api',
  'inventory', 'warehouse', 'stock', 'barcode', 'lot', 'batch',
  'payroll', 'hr', 'human resource', 'attendance', 'leave', 'employee', 'onboard',
  'sap', 'oracle', 'dynamics',
]

const DATA_KEYWORDS = [
  'crm', 'lead', 'contact', 'pipeline', 'opportunity', 'deal', 'sales', 'forecast',
  'analytics', 'dashboard', 'report', 'chart', 'bi', 'visualize', 'visualisation',
  'data', 'export', 'import', 'query', 'database', 'warehouse', 'refresh', 'connector',
]

const PRIORITY_SIGNALS: { priority: Priority; keywords: string[] }[] = [
  {
    priority: 'critical',
    keywords: ['crash', 'down', 'outage', 'data loss', 'corrupt', 'production', 'breach', 'security', 'blocked entirely', 'cannot process', 'emergency', 'critical'],
  },
  {
    priority: 'high',
    keywords: ['error', 'failing', 'broken', 'wrong', 'incorrect', 'mismatch', 'not working', 'urgent', 'not syncing'],
  },
  {
    priority: 'medium',
    keywords: ['slow', 'performance', 'intermittent', 'sometimes', 'not showing', 'occasional', 'delay'],
  },
]

function teamKeywords(teamName: string): string[] {
  const lower = teamName.toLowerCase()
  if (lower.includes('alpha') || lower.includes('ops')) return OPS_KEYWORDS
  if (lower.includes('beta') || lower.includes('data')) return DATA_KEYWORDS
  return [...OPS_KEYWORDS, ...DATA_KEYWORDS]
}

function countMatches(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase()
  return keywords.filter((kw) => lower.includes(kw))
}

function detectPriority(text: string): { priority: Priority; matched: string[] } {
  const lower = text.toLowerCase()
  for (const sig of PRIORITY_SIGNALS) {
    const matched = sig.keywords.filter((kw) => lower.includes(kw))
    if (matched.length > 0) return { priority: sig.priority, matched }
  }
  return { priority: 'medium', matched: [] }
}

export const ruleTriageEngine: AITriageEngine = {
  suggest(title: string, description: string, teams: Team[]): TriageSuggestion | null {
    if (teams.length === 0) return null
    const text = `${title} ${description}`

    const scored = teams.map((team) => {
      const kws = teamKeywords(team.name)
      const matches = countMatches(text, kws)
      return { team, matches }
    })

    const best = scored.reduce((a, b) => a.matches.length >= b.matches.length ? a : b)

    // Require at least 1 keyword match for a team suggestion
    if (best.matches.length === 0) return null

    const totalMatches = scored.reduce((s, x) => s + x.matches.length, 0)
    const confidence = Math.min(best.matches.length / Math.max(totalMatches, 1), 1)

    const { priority, matched: priMatched } = detectPriority(text)

    let reasoning = `Keywords "${best.matches.slice(0, 3).join('", "')}" suggest ${best.team.name}.`
    if (priMatched.length > 0) {
      reasoning += ` "${priMatched.slice(0, 2).join('", "')}" indicates ${priority} priority.`
    }

    return {
      team_id: best.team.id,
      team_name: best.team.name,
      priority,
      confidence,
      reasoning,
    }
  },
}