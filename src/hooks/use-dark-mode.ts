'use client'

import { useSyncExternalStore } from 'react'

// Tracks the app theme (`.dark` class on <html>, toggled by the topbar).
// useSyncExternalStore + MutationObserver keeps components in sync with theme
// switches without prop drilling or a context provider.

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains('dark')
}

export function useIsDarkMode(): boolean {
  // Server snapshot is `false`; the client corrects on hydration.
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
