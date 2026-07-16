'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useSession } from '@/lib/auth/context'
import { ArticleEditor } from '@/modules/solutions/article-editor'

// Clients read the knowledge base; staff write it.
export default function NewSolutionArticlePage() {
  const session = useSession()
  const router = useRouter()

  const canWrite = session.role !== 'client'
  useEffect(() => {
    if (!canWrite) router.replace('/solutions')
  }, [canWrite, router])

  if (!canWrite) return null
  return <ArticleEditor />
}
