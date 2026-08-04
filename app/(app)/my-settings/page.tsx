'use client'

import { redirect } from 'next/navigation'

// Settings now live at the single shared /settings route (content is
// branched by role there) — keep this path alive for old links/bookmarks.
export default function MySettingsPage() {
  redirect('/settings')
}
