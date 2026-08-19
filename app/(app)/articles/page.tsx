'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Newspaper, Lightbulb, BookOpen } from 'lucide-react'

const SolutionsPage = dynamic(
  () => import('@/modules/solutions/solutions-page').then((m) => m.SolutionsPage),
  { loading: () => <ArticlesTabSkeleton /> }
)
const KnowledgeBasePage = dynamic(
  () => import('@/modules/kb/kb-page').then((m) => m.KnowledgeBasePage),
  { loading: () => <ArticlesTabSkeleton /> }
)
const NewSolutionForm = dynamic(
  () => import('@/modules/solutions/new-solution-form').then((m) => m.NewSolutionForm),
  { loading: () => <div className="p-6"><ArticlesTabSkeleton /></div> }
)
const KBEditor = dynamic(
  () => import('@/modules/kb/kb-editor').then((m) => m.KBEditor),
  { loading: () => <div className="p-6"><ArticlesTabSkeleton /></div> }
)

function ArticlesTabSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  )
}

const ARTICLES_TABS = ['solutions', 'knowledge-base']
// Sub-state of the Solutions tab — the create-solution form, kept under the
// same /articles URL namespace instead of navigating away to /solutions/new.
const NEW_SOLUTION_TAB = 'solutions/new'
// Sub-state of the Knowledge Base tab — the create-article editor, kept under
// the same /articles URL namespace instead of navigating away to /knowledge-base/new.
const NEW_KB_TAB = 'knowledge-base/new'

export default function ArticlesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const [activeTab, setActiveTabState] = useState<string>(() => {
    const t = searchParams.get('tab')
    return t && ARTICLES_TABS.includes(t) ? t : 'solutions'
  })
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // Land on /articles with no ?tab= at all → normalize the URL to reflect the
  // tab that's actually showing by default, so the address bar never lies
  // about what's on screen.
  useEffect(() => {
    if (!searchParams.get('tab')) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', activeTab)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
    // Mount-only: this is a one-time normalization, not a sync loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lightweight counts for the hero + tab badges — same query keys as the
  // embedded pages so React Query dedupes the underlying fetch.
  const { data: solutions } = useQuery({ queryKey: ['solutions'], queryFn: () => dp.listSolutions() })
  const { data: kbArticles } = useQuery({ queryKey: ['kb', 'index', session.userId, ''], queryFn: () => dp.listKBArticles({}, scope) })
  const solutionsCount = solutions?.length ?? 0
  const kbCount = (kbArticles ?? []).filter((a) => a.status === 'published').length

  // ?tab=solutions/new — the create-solution form takes over the whole page,
  // same as a dedicated route would, but without leaving /articles.
  if (searchParams.get('tab') === NEW_SOLUTION_TAB) {
    return <NewSolutionForm onBack={() => setActiveTab('solutions')} />
  }
  // ?tab=knowledge-base/new — same idea for the create-article editor.
  if (searchParams.get('tab') === NEW_KB_TAB) {
    return <KBEditor backHref={`${pathname}?tab=knowledge-base`} />
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Hero header */}
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-primary/15 p-3 shrink-0">
          <Newspaper className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Articles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {solutionsCount} solution{solutionsCount !== 1 ? 's' : ''} · {kbCount} KB Articles{kbCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="h-auto w-full flex-wrap gap-1 p-1 sm:w-auto">
          <TabsTrigger value="solutions" className="flex-1 gap-1.5 sm:flex-none">
            <Lightbulb className="h-3.5 w-3.5" /> Solutions
            <span className="ml-0.5 text-[10px] tabular-nums opacity-70">({solutionsCount})</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge-base" className="flex-1 gap-1.5 sm:flex-none">
            <BookOpen className="h-3.5 w-3.5" /> Knowledge Base
            <span className="ml-0.5 text-[10px] tabular-nums opacity-70">({kbCount})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="solutions" className="mt-0">
          <SolutionsPage newSolutionHref={`/articles?tab=${NEW_SOLUTION_TAB}`} />
        </TabsContent>
        <TabsContent value="knowledge-base" className="mt-0">
          <KnowledgeBasePage newArticleHref={`/articles?tab=${NEW_KB_TAB}`} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
