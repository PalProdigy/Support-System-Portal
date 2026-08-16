import { cn } from '@/lib/utils'

// Fixed dark "command bar" chrome for the messaging search and composer
// fields — deliberately independent of the app's light/dark theme, per spec:
// bg #1C202B (--ink-700) -> #232837 (--ink-600) on focus, border #21262F
// (--line-soft) -> #2A3040 (--line) on focus, 12px radius, placeholder
// #6B7286 (--text-faint), border-color/background-color transition .15s.
const MESSAGING_FIELD_BASE_CLASS = cn(
  'h-auto rounded-[12px] border border-[#21262F] bg-[#1C202B]',
  'text-sm text-[#E6E8EE] shadow-none placeholder:text-[#6B7286]',
  'transition-colors duration-150 ease-linear',
  'focus-visible:outline-none focus-visible:ring-0 focus-visible:border-[#2A3040] focus-visible:bg-[#232837]',
)

// Search fields: left gap for the search icon, right gap matching the spec's key hint.
export const MESSAGING_SEARCH_FIELD_CLASS = cn(MESSAGING_FIELD_BASE_CLASS, 'py-[9px] pl-[34px] pr-[44px]')

// Chat composer field: no inline icon, so plain balanced padding.
export const MESSAGING_COMPOSER_FIELD_CLASS = cn(MESSAGING_FIELD_BASE_CLASS, 'px-[14px] py-[9px]')
