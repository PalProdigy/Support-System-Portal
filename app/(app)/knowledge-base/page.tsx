'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { canAccess } from '@/lib/rbac'
import { formatDate } from '@/lib/utils'
import { BookOpen, PlusCircle, Search, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { KBArticle } from '@/types'

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function KnowledgeBasePage() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<KBArticle | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', tags: '', status: 'draft' as KBArticle['status'] })

  const { data: articles, isLoading } = useQuery({
    queryKey: ['kb', search, status],
    queryFn: () => dp.listKBArticles({ search: search || undefined, status: status === 'all' ? undefined : status }),
  })

  const canManage = canAccess(scope, 'manage_kb', 'kb_article')

  const createMutation = useMutation({
    mutationFn: () =>
      dp.createKBArticle({
        title: form.title, body: form.body,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        status: form.status,
        author_id: session.userId,
        published_at: form.status === 'published' ? new Date().toISOString() : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb'] })
      toast({ title: 'Article created', variant: 'success' })
      setShowCreate(false)
      setForm({ title: '', body: '', tags: '', status: 'draft' })
    },
    onError: () => toast({ title: 'Failed to create article', variant: 'destructive' }),
  })

  const publishMutation = useMutation({
    mutationFn: (id: string) =>
      dp.updateKBArticle(id, { status: 'published', published_at: new Date().toISOString() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb'] })
      toast({ title: 'Article published', variant: 'success' })
    },
  })

  const statusColor: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    archived: 'bg-muted text-muted-foreground',
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">{articles?.length ?? 0} articles</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreate(true)}>
            <PlusCircle className="h-4 w-4" /> New Article
          </Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search articles..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : (articles ?? []).length === 0 ? (
        <EmptyState icon={BookOpen} title="No articles found" description={search ? 'Try different keywords.' : 'No KB articles yet.'} />
      ) : (
        <div className="space-y-3">
          {(articles ?? []).map((a: KBArticle) => (
            <div
              key={a.id}
              className="rounded-xl border bg-card p-4 hover:shadow-sm hover:border-primary/40 transition-all cursor-pointer"
              onClick={() => router.push(`/knowledge-base/${slugify(a.title)}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statusColor[a.status]}`}>
                      {a.status}
                    </span>
                    {a.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                  <h3 className="font-semibold text-foreground">{a.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.published_at ? `Published ${formatDate(a.published_at)}` : `Updated ${formatDate(a.updated_at)}`}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Quick view"
                    onClick={(e) => { e.stopPropagation(); setSelected(a) }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {canManage && a.status === 'draft' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); publishMutation.mutate(a.id) }}
                    >
                      Publish
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {selected?.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
          </div>
          <pre className="text-sm whitespace-pre-wrap font-sans text-foreground leading-relaxed">{selected?.body}</pre>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      {canManage && (
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New KB Article</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Article title" />
              </div>
              <div className="space-y-1.5">
                <Label>Content (Markdown supported)</Label>
                <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={8} placeholder="Write your article..." />
              </div>
              <div className="space-y-1.5">
                <Label>Tags (comma-separated)</Label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="erp, integration, api" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as KBArticle['status'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button disabled={createMutation.isPending || !form.title} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  )
}