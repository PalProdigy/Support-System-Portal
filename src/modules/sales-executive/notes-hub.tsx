'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { PreSalesNotesPanel } from './pre-sales-notes'
import { EmptyState } from '@/components/shared/empty-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MessageSquare, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { Client } from '@/types'

export function NotesHub() {
  const session = useSession()
  const dp = getDataProvider()
  const scope = { userId: session.userId, role: session.role }

  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [search, setSearch] = useState('')

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', session.userId],
    queryFn: () => dp.listClients(scope),
  })

  const filteredClients = clients.filter((c: Client) =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_person.toLowerCase().includes(search.toLowerCase())
  )

  const selectedClient = clients.find((c: Client) => c.id === selectedClientId)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Select a client" />
          </SelectTrigger>
          <SelectContent>
            {filteredClients.map((c: Client) => (
              <SelectItem key={c.id} value={c.id}>
                {c.company_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedClientId && selectedClient ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Client info */}
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Client Info</p>
            <div className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Company:</span> {selectedClient.company_name}</p>
              <p><span className="text-muted-foreground">Contact:</span> {selectedClient.contact_person}</p>
              <p><span className="text-muted-foreground">Phone:</span> {selectedClient.phone}</p>
              {selectedClient.email && (
                <p><span className="text-muted-foreground">Email:</span> {selectedClient.email}</p>
              )}
              {selectedClient.industry && (
                <p><span className="text-muted-foreground">Industry:</span> {selectedClient.industry}</p>
              )}
            </div>
          </div>

          {/* Notes panel */}
          <div className="lg:col-span-2">
            <PreSalesNotesPanel clientId={selectedClientId} />
          </div>
        </div>
      ) : (
        <EmptyState
          icon={MessageSquare}
          title="No client selected"
          description="Select a client from the list to view and manage notes."
        />
      )}
    </div>
  )
}
