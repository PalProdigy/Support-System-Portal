'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { cn, formatBytes, formatDateTime } from '@/lib/utils'
import { Paperclip, Upload, Download, X, FileText } from 'lucide-react'
import type { Attachment } from '@/types'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'txt', 'log', 'csv', 'zip', 'doc', 'docx', 'xls', 'xlsx']
const ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.log,.csv,.zip,.doc,.docx,.xls,.xlsx'

function validate(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `"${file.name}" — unsupported file type (.${ext})`
  }
  if (file.size > MAX_SIZE) {
    return `"${file.name}" — exceeds the ${formatBytes(MAX_SIZE)} limit`
  }
  return null
}

export function CaseAttachments({ caseId, canManage = true }: { caseId: string; canManage?: boolean }) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const { data: attachments, isLoading } = useQuery({
    queryKey: ['attachments', caseId],
    queryFn: () => dp.listAttachments(caseId),
  })

  const addMutation = useMutation({
    mutationFn: (file: File) =>
      dp.addAttachment({
        case_id: caseId,
        uploaded_by: session.userId,
        // Object URL keeps the file downloadable for the current session.
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
    if (valid.length > 0) {
      toast({ title: `Uploading ${valid.length} file${valid.length > 1 ? 's' : ''}…`, variant: 'success' })
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const list = attachments ?? []

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <Paperclip className="h-3.5 w-3.5" /> Attachments {list.length > 0 && `(${list.length})`}
      </h3>

      {/* Attachment list */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((a: Attachment) => (
            <li key={a.id} className="flex items-center gap-2.5 rounded-lg border bg-card p-2.5">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{a.file_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatBytes(a.size)} · {formatDateTime(a.created_at)}
                </p>
              </div>
              <a
                href={a.file_url}
                download={a.file_name}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors p-1"
                title="Download"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="h-4 w-4" />
              </a>
              {canManage && (
                <button
                  type="button"
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(a.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1 disabled:opacity-50"
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Upload zone */}
      {canManage && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFiles(e.dataTransfer.files)
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-4 cursor-pointer transition-colors text-center',
            dragging ? 'border-primary bg-primary/5' : 'bg-muted/30 hover:bg-muted/50'
          )}
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Click to upload</span> or drag and drop
          </p>
          <p className="text-[10px] text-muted-foreground">
            Images, PDF, documents, archives · up to {formatBytes(MAX_SIZE)}
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}
    </div>
  )
}
