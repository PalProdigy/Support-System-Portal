'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/empty-state'
import { UserAvatar } from '@/components/shared/user-avatar'
import { toast } from '@/hooks/use-toast'
import { Pencil, Trash2, Plus, MessageSquare, Loader2, X } from 'lucide-react'
import { formatDateTime, cn } from '@/lib/utils'
import type { PreSalesNote } from '@/types'

interface PreSalesNotesPanelProps {
  clientId: string
}

export function PreSalesNotesPanel({ clientId }: PreSalesNotesPanelProps) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [showForm, setShowForm] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState('')

  // Fetch notes (mock - in real app would use actual endpoint)
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['pre-sales-notes', clientId],
    queryFn: async () => {
      // Mock: return empty array for now
      // In production, call: dp.listPreSalesNotes(clientId, scope)
      return []
    },
  })

  const createNoteMutation = useMutation({
    mutationFn: async (body: string) => {
      // Mock mutation - replace with actual API call
      const newNote: PreSalesNote = {
        id: `note-${Date.now()}`,
        client_id: clientId,
        author_id: session.userId,
        author_name: 'You',
        body,
        created_at: new Date().toISOString(),
      }
      return newNote
    },
    onSuccess: () => {
      setNoteBody('')
      setShowForm(false)
      qc.invalidateQueries({ queryKey: ['pre-sales-notes', clientId] })
      toast({ title: 'Note added', variant: 'success' })
    },
    onError: (err) => {
      toast({ title: String(err), variant: 'destructive' })
    },
  })

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      // Mock mutation - replace with actual API call
      return { id, body, updated_at: new Date().toISOString() }
    },
    onSuccess: () => {
      setEditingId(null)
      setEditingBody('')
      qc.invalidateQueries({ queryKey: ['pre-sales-notes', clientId] })
      toast({ title: 'Note updated', variant: 'success' })
    },
    onError: (err) => {
      toast({ title: String(err), variant: 'destructive' })
    },
  })

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Mock mutation - replace with actual API call
      return id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pre-sales-notes', clientId] })
      toast({ title: 'Note deleted', variant: 'success' })
    },
    onError: (err) => {
      toast({ title: String(err), variant: 'destructive' })
    },
  })

  const handleSave = () => {
    if (!noteBody.trim()) {
      toast({ title: 'Please write a note', variant: 'destructive' })
      return
    }
    createNoteMutation.mutate(noteBody)
  }

  const handleUpdate = () => {
    if (!editingBody.trim() || !editingId) return
    updateNoteMutation.mutate({ id: editingId, body: editingBody })
  }

  const isEditing = editingId && notes.find((n: PreSalesNote) => n.id === editingId)

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5" />
          Pre-Sales Notes
        </h3>
        {!showForm && !editingId && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Add/Edit form */}
      {(showForm || editingId) && (
        <div className="space-y-2 p-2 bg-muted/50 rounded-lg border border-dashed">
          <Textarea
            placeholder="Write a note..."
            value={editingId ? editingBody : noteBody}
            onChange={(e) => editingId ? setEditingBody(e.target.value) : setNoteBody(e.target.value)}
            rows={3}
            className="text-sm"
          />
          <div className="flex items-center gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
                setNoteBody('')
                setEditingBody('')
              }}
              disabled={createNoteMutation.isPending || updateNoteMutation.isPending}
            >
              <X className="h-3 w-3" /> Cancel
            </Button>
            <Button
              size="sm"
              onClick={editingId ? handleUpdate : handleSave}
              disabled={createNoteMutation.isPending || updateNoteMutation.isPending}
            >
              {(createNoteMutation.isPending || updateNoteMutation.isPending) && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              {editingId ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No notes"
          description="Add notes to share context with your team."
          size="sm"
        />
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {notes.map((note: PreSalesNote) => {
            const isCurrentUserNote = note.author_id === session.userId
            return (
              <div
                key={note.id}
                className={cn(
                  'p-2.5 rounded-lg border text-sm space-y-1.5',
                  isCurrentUserNote
                    ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                    : 'bg-muted/50 border-border'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <UserAvatar name={note.author_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{note.author_name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDateTime(note.created_at)}</p>
                    </div>
                  </div>
                  {isCurrentUserNote && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingId(note.id)
                          setEditingBody(note.body)
                        }}
                        className="p-1 rounded hover:bg-muted transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => deleteNoteMutation.mutate(note.id)}
                        className="p-1 rounded hover:bg-muted transition-colors"
                        title="Delete"
                        disabled={deleteNoteMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-foreground whitespace-pre-wrap">{note.body}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
