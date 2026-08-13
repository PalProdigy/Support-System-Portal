'use client'

import { useSyncExternalStore } from 'react'

// Touch-only devices (phones/tablets) can't trigger CSS/JS `hover` — a tap
// fires a single transient mouseenter/mouseleave pair at best, so
// hover-driven UI (e.g. Recharts Tooltip) never reliably shows. Charts use
// this to switch their Tooltip from hover-to-reveal to tap-to-reveal only
// where it's actually needed, leaving desktop hover untouched.
const QUERY = '(hover: none) and (pointer: coarse)'

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches
}

export function useIsTouchDevice(): boolean {
  // Server snapshot is `false`; the client corrects on hydration.
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
