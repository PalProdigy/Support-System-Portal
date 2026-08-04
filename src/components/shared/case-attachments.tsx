'use client'

import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { formatBytes, formatDateTime } from '@/lib/utils'
import { Paperclip, Upload, Download, X, FileText, Eye, ChevronLeft, ChevronRight, Search, Image, FileArchive, FileSpreadsheet } from 'lucide-react'
import type { Attachment } from '@/types'

const PAGE_SIZE = 8
const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'txt', 'log', 'csv', 'zip', 'doc', 'docx', 'xls', 'xlsx']
const ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.log,.csv,.zip,.doc,.docx,.xls,.xlsx'
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp']

function validate(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) return `"${file.name}" — unsupported file type (.${ext})`
  if (file.size > MAX_SIZE) return `"${file.name}" — exceeds the ${formatBytes(MAX_SIZE)} limit`
  return null
}

function extOf(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function typeIcon(name: string) {
  const ext = extOf(name)
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return <Image className="h-4 w-4 text-sky-500" />
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <FileArchive className="h-4 w-4 text-amber-500" />
  if (['csv', 'xls', 'xlsx'].includes(ext)) return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
  return <FileText className="h-4 w-4 text-muted-foreground" />
}

type SortKey = 'created_at' | 'file_name' | 'size'

export function CaseAttachments({ caseId, canManage = true }: { caseId: string; canManage?: boolean }) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewing, setPreviewing] = useState<Attachment | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('created_at')
  const [page, setPage] = useState(1)

  const { data: attachments, isLoading } = useQuery({
    queryKey: ['attachments', caseId],
    queryFn: () => dp.listAttachments(caseId),
  })

  const addMutation = useMutation({
    mutationFn: (file: File) =>
      dp.addAttachment({
        case_id: caseId,
        uploaded_by: session.userId,
        file_url: URL.createObjectURL(file),
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        category: 'attachment',
        size: file.size,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', caseId] }),
    onError: () => toast({ title: 'Failed to upload attachment', variant: 'destructive' }),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => dp.removeAttachment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attachments', caseId] })
      toast({ title: 'Attachment removed', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to remove attachment', variant: 'destructive' }),
  })

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    const valid: File[] = []
    for (const f of files) {
      const err = validate(f)
      if (err) toast({ title: 'Invalid file', description: err, variant: 'destructive' })
      else valid.push(f)
    }
    valid.forEach((f) => addMutation.mutate(f))
    if (valid.length > 0) toast({ title: `Uploading ${valid.length} file${valid.length > 1 ? 's' : ''}…`, variant: 'success' })
    if (inputRef.current) inputRef.current.value = ''
  }

  const list = attachments ?? []

  const filtered = useMemo(() => {
    let items = search ? list.filter((a) => a.file_name.toLowerCase().includes(search.toLowerCase())) : list
    items = [...items].sort((a, b) => {
      if (sortBy === 'file_name') return a.file_name.localeCompare(b.file_name)
      if (sortBy === 'size') return b.size - a.size
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return items
  }, [list, search, sortBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            Attachments <span className="text-muted-foreground font-normal">· {list.length} items</span>
          </h3>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Sorted by {sortBy === 'created_at' ? 'Last Modified' : sortBy === 'file_name' ? 'Name' : 'Size'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search files…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="h-8 w-44 pl-8 text-xs"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => { setSortBy(v as SortKey); setPage(1) }}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Last Modified</SelectItem>
              <SelectItem value="file_name">Name</SelectItem>
              <SelectItem value="size">Size</SelectItem>
            </SelectContent>
          </Select>
          {canManage && (
            <Button size="sm" className="h-8" onClick={() => inputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Add Files
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          {search ? 'No files match your search.' : 'No attachments yet.'}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left font-medium text-muted-foreground px-3 py-2.5 w-8" />
                <th className="text-left font-medium text-muted-foreground px-3 py-2.5">Title</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-2.5 hidden sm:table-cell">Created By</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-2.5 hidden md:table-cell">Size</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-2.5 hidden lg:table-cell">Source</th>
                <th className="text-right font-medium text-muted-foreground px-3 py-2.5 w-20">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.map((a: Attachment) => (
                <tr key={a.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setPreviewing(a)}>
                  <td className="px-3 py-2.5">{typeIcon(a.file_name)}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground truncate max-w-[200px] sm:max-w-[300px]">{a.file_name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(a.created_at)}</p>
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell text-muted-foreground">{a.uploaded_by_name ?? a.uploaded_by}</td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">{formatBytes(a.size)}</td>
                  <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground">{a.source ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setPreviewing(a)} className="h-7 w-7 rounded-md hover:bg-muted-foreground/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Preview">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <a href={a.file_url} download={a.file_name} target="_blank" rel="noreferrer" className="h-7 w-7 rounded-md hover:bg-muted-foreground/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Download">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      {canManage && (
                        <button onClick={() => removeMutation.mutate(a.id)} disabled={removeMutation.isPending} className="h-7 w-7 rounded-md hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50" title="Remove">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} items</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => (
              <Button key={i} variant={page === i + 1 ? 'default' : 'ghost'} size="icon" className="h-7 w-7 text-xs" onClick={() => setPage(i + 1)}>
                {i + 1}
              </Button>
            ))}
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input ref={inputRef} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => handleFiles(e.target.files)} />

      {/* Preview dialog */}
      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          {previewing && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate pr-6">{previewing.file_name}</DialogTitle>
              </DialogHeader>
              <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center rounded-lg bg-muted/30">
                {IMAGE_EXTENSIONS.includes(extOf(previewing.file_name)) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewing.file_url} alt={previewing.file_name} className="max-w-full max-h-[65vh] object-contain" />
                ) : extOf(previewing.file_name) === 'pdf' ? (
                  <iframe src={previewing.file_url} title={previewing.file_name} className="w-full h-[65vh] rounded-lg border-0" />
                ) : (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Preview isn&apos;t available for this file type.</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-muted-foreground">{formatBytes(previewing.size)} · {formatDateTime(previewing.created_at)}</p>
                <a href={previewing.file_url} download={previewing.file_name} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline"><Download className="h-3.5 w-3.5" /> Download</Button>
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}