'use client'

import { useSyncExternalStore } from 'react'

// Matches Tailwind's `md` breakpoint (768px) — below it, layouts like the
// messaging drawer switch from a right-side panel to a bottom sheet.
const QUERY = '(max-width: 767px)'

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches
}

export function useIsMobile(): boolean {
  // Server snapshot is `false`; the client corrects on hydration.
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
