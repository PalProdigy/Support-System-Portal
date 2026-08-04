'use client'

import { useState } from 'react'
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

function ArticlesTabSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  )
}

const ARTICLES_TABS = ['solutions', 'knowledge-base']

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

  // Lightweight counts for the hero + tab badges — same query keys as the
  // embedded pages so React Query dedupes the underlying fetch.
  const { data: solutions } = useQuery({ queryKey: ['solutions'], queryFn: () => dp.listSolutions() })
  const { data: kbArticles } = useQuery({ queryKey: ['kb', 'index', session.userId, ''], queryFn: () => dp.listKBArticles({}, scope) })
  const solutionsCount = solutions?.length ?? 0
  const kbCount = (kbArticles ?? []).filter((a) => a.status === 'published').length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Hero header */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 flex items-center gap-4">
        <div className="rounded-xl bg-primary/15 p-3 shrink-0">
          <Newspaper className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Articles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {solutionsCount} solution{solutionsCount !== 1 ? 's' : ''} · {kbCount} knowledge base article{kbCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="solutions" className="gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" /> Solutions
            <span className="ml-0.5 text-[10px] tabular-nums opacity-70">({solutionsCount})</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge-base" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Knowledge Base
            <span className="ml-0.5 text-[10px] tabular-nums opacity-70">({kbCount})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="solutions" className="mt-0">
          <SolutionsPage />
        </TabsContent>
        <TabsContent value="knowledge-base" className="mt-0">
          <KnowledgeBasePage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
