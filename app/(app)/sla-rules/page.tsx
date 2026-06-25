'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PriorityChip } from '@/components/shared/priority-chip'
import { toast } from '@/hooks/use-toast'
import { canAccess } from '@/lib/rbac'
import { useRouter } from 'next/navigation'
import type { SLARule, Priority } from '@/types'

export default function SLARulesPage() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const router = useRouter()
  const scope = { userId: session.userId, role: session.role }

  if (!canAccess(scope, 'manage_sla', 'sla_rule')) {
    router.replace('/dashboard')
    return null
  }

  return <SLARulesContent />
}

function SLARulesContent() {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [editing, setEditing] = useState<SLARule | null>(null)

  const { data: rules } = useQuery({ queryKey: ['sla-rules'], queryFn: () => dp.listSLARules() })

  const saveMutation = useMutation({
    mutationFn: (rule: SLARule) => dp.upsertSLARule(rule),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sla-rules'] })
      toast({ title: 'SLA rule saved', variant: 'success' })
      setEditing(null)
    },
    onError: () => toast({ title: 'Failed to save', variant: 'destructive' }),
  })

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">SLA Rules</h1>
        <p className="text-sm text-muted-foreground">Response and resolution time targets per priority</p>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Response Time</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Resolution Time</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Business Hours</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {(rules ?? []).map((r: SLARule) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-4 py-3"><PriorityChip priority={r.priority as Priority} /></td>
                <td className="px-4 py-3 text-foreground">{r.response_time_minutes < 60 ? `${r.response_time_minutes}m` : `${r.response_time_minutes / 60}h`}</td>
                <td className="px-4 py-3 text-foreground">{r.resolution_time_minutes < 60 ? `${r.resolution_time_minutes}m` : `${r.resolution_time_minutes >= 1440 ? (r.resolution_time_minutes / 1440) + 'd' : (r.resolution_time_minutes / 60) + 'h'}`}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${r.business_hours_only ? 'text-blue-600' : 'text-red-600'}`}>
                    {r.business_hours_only ? 'Yes' : 'No (24/7)'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ ...r })}>Edit</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit SLA Rule — {editing && <PriorityChip priority={editing.priority as Priority} />}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Response Time (minutes)</Label>
                  <Input
                    type="number"
                    value={editing.response_time_minutes}
                    onChange={(e) => setEditing({ ...editing, response_time_minutes: +e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Resolution Time (minutes)</Label>
                  <Input
                    type="number"
                    value={editing.resolution_time_minutes}
                    onChange={(e) => setEditing({ ...editing, resolution_time_minutes: +e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="biz-hours"
                  checked={editing.business_hours_only}
                  onCheckedChange={(v) => setEditing({ ...editing, business_hours_only: v })}
                />
                <Label htmlFor="biz-hours">Business hours only</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={saveMutation.isPending} onClick={() => editing && saveMutation.mutate(editing)}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}