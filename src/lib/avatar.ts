/**
 * Avatar utilities for generating consistent, deterministic colors
 * and styling based on user identity.
 */

type ColorScheme = {
  bg: string
  text: string
}

// Professional, corporate color palette for avatar fallbacks
// Colors are deterministic based on hash of initials/name
const AVATAR_COLOR_PALETTE: ColorScheme[] = [
  // Blues (calm, professional)
  { bg: 'bg-blue-500', text: 'text-white' },
  { bg: 'bg-blue-600', text: 'text-white' },
  { bg: 'bg-cyan-500', text: 'text-white' },
  { bg: 'bg-indigo-500', text: 'text-white' },
  // Purples (creative, thoughtful)
  { bg: 'bg-purple-500', text: 'text-white' },
  { bg: 'bg-violet-500', text: 'text-white' },
  // Teals (trust, balance)
  { bg: 'bg-teal-500', text: 'text-white' },
  { bg: 'bg-emerald-500', text: 'text-white' },
  // Warm tones (energy, approachable)
  { bg: 'bg-amber-500', text: 'text-white' },
  { bg: 'bg-orange-500', text: 'text-white' },
  { bg: 'bg-rose-500', text: 'text-white' },
  { bg: 'bg-pink-500', text: 'text-white' },
]

/**
 * Generate a deterministic hash from a string (name, email, id, etc.)
 * Returns a number that can be used to select from color palette
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Get a consistent color scheme for a user based on their identifier
 * @param identifier - Can be user ID, email, or name
 * @returns Color scheme with bg and text classes
 */
export function getAvatarColorScheme(identifier: string): ColorScheme {
  if (!identifier || identifier.trim() === '') {
    return AVATAR_COLOR_PALETTE[0]
  }
  const hash = hashString(identifier.toLowerCase())
  const index = hash % AVATAR_COLOR_PALETTE.length
  return AVATAR_COLOR_PALETTE[index]
}

/**
 * Check if a URL is valid and not a data URL
 * Returns true if it's a proper URL (http, https, or blob)
 */
export function isValidImageUrl(url?: string): url is string {
  if (!url || typeof url !== 'string') return false
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  )
}

/**
 * Get border styling classes based on size
 */
export function getAvatarBorderClasses(size: 'sm' | 'md' | 'lg' | 'xl'): string {
  const borderMap = {
    sm: 'border border-slate-200 dark:border-slate-700',
    md: 'border border-slate-200 dark:border-slate-700',
    lg: 'border-2 border-slate-200 dark:border-slate-700',
    xl: 'border-2 border-slate-300 dark:border-slate-600',
  }
  return borderMap[size]
}

/**
 * Get shadow styling classes based on size
 */
export function getAvatarShadowClasses(size: 'sm' | 'md' | 'lg' | 'xl'): string {
  const shadowMap = {
    sm: 'shadow-sm',
    md: 'shadow',
    lg: 'shadow-md',
    xl: 'shadow-lg',
  }
  return shadowMap[size]
}

/**
 * Get consistent sizing and text classes
 */
export function getAvatarSizeClasses(size: 'sm' | 'md' | 'lg' | 'xl'): string {
  const sizeMap = {
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-10 w-10 text-sm',
    xl: 'h-12 w-12 text-base',
  }
  return sizeMap[size]
}
