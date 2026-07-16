'use client'

import { use } from 'react'
import { KBEditor } from '@/modules/kb/kb-editor'

export default function EditKBArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return <KBEditor slug={slug} />
}
