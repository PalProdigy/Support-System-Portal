'use client'

import { use } from 'react'
import { ArticleEditor } from '@/modules/solutions/article-editor'

// Edit an existing article. ArticleEditor enforces that only the author can
// edit (the future backend re-checks this server-side).
export default function EditSolutionArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return <ArticleEditor slug={slug} />
}
