'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { SearchableSelect } from '@/components/shared/searchable-select'
import { IconField } from '@/components/shared/icon-field'
import { toast } from '@/hooks/use-toast'
import { Package, PlusCircle, ArrowRight, X, Factory, User, Mail, Phone, Briefcase, IdCard, CalendarDays } from 'lucide-react'
import { canAccess } from '@/lib/rbac'
import type { Product } from '@/types'
import { getCategoryMeta, loadOemOptions, saveOemOptions } from '@/lib/products-shared'

export default function ProductCategoriesPage() {
  const session = useSession()
  const router = useRouter()
  const dp = getDataProvider()
  const qc = useQueryClient()
  const scope = { userId: session.userId, role: session.role }

  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const emptyForm = {
    name: '', description: '', category: '', is_active: true,
    manager: { name: '', email: '', phone: '', designation: '', employee_id: '', joining_date: '' },
  }
  const [form, setForm] = useState(emptyForm)
  const [oemOptions, setOemOptions] = useState<string[]>(() => loadOemOptions())
  const [showManageOem, setShowManageOem] = useState(false)
  const [newOemName, setNewOemName] = useState('')

  function addOem() {
    const name = newOemName.trim()
    if (!name || oemOptions.some((o) => o.toLowerCase() === name.toLowerCase())) return
    const next = [...oemOptions, name].sort((a, b) => a.localeCompare(b))
    setOemOptions(next)
    saveOemOptions(next)
    setNewOemName('')
  }

  const { data: products, isLoading } = useQuery({ queryKey: ['products'], queryFn: () => dp.listProducts() })
  const canManage = canAccess(scope, 'manage_products', 'product')

  // Managers see inactive products too; everyone else only sees the live catalog.
  const visible = useMemo(() => (products ?? []).filter((p) => canManage || p.is_active), [products, canManage])

  const categories = useMemo(() => {
    const byName = new Map<string, Product[]>()
    for (const p of visible) {
      const key = p.category || 'Other'
      byName.set(key, [...(byName.get(key) ?? []), p])
    }
    return [...byName.entries()].map(([name, items]) => ({ name, items, meta: getCategoryMeta(name) }))
  }, [visible])

  // Dropdown option list — independent of the current search/filter state.
  const categoryOptions = useMemo(() => [...categories].sort((a, b) => a.name.localeCompare(b.name)), [categories])

  function handleCategoryChange(name: string) {
    setCategoryFilter(name)
  }

  function clearDropdownFilters() {
    setCategoryFilter('all')
  }

  const hasDropdownFilter = categoryFilter !== 'all'

  const searching = query.trim().length > 0
  const searchResults = useMemo(() => {
    if (!searching) return []
    const q = query.toLowerCase()
    // Matches either the OEM (group) name itself or any product name inside it.
    return categories.filter((c) =>
      c.name.toLowerCase().includes(q) || c.items.some((p) => p.name.toLowerCase().includes(q))
    )
  }, [categories, query, searching])

  const displayedCategories = useMemo(() => {
    const base = searching ? searchResults : categories
    return categoryFilter !== 'all' ? base.filter((c) => c.name === categoryFilter) : base
  }, [searching, searchResults, categories, categoryFilter])

  const createMutation = useMutation({
    mutationFn: () => dp.createProduct({
      ...form,
      manager: form.manager.name.trim() ? form.manager : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast({ title: 'Category created', variant: 'success' }); setShowCreate(false); setForm(emptyForm) },
    onError: () => toast({ title: 'Failed', variant: 'destructive' }),
  })

  function openCategory(name: string) {
    router.push(`/products/${encodeURIComponent(name)}`)
  }

  return (
    <div className="space-y-6 px-6 py-10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Products by OEM</h1>
            <p className="text-sm text-muted-foreground">Browse NHQ&apos;s product portfolio by OEM · {categories.length} {categories.length === 1 ? 'OEM' : 'OEMs'}</p>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setShowManageOem(true)}>
              <Factory className="h-4 w-4" /> Add OEM
            </Button>
            <Button type="button" onClick={() => setShowCreate(true)}>
              <PlusCircle className="h-4 w-4" /> Add Product
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          containerClassName="w-full max-w-md"
          placeholder="Search OEM or product…"
          value={query}
          onChange={setQuery}
          aria-label="Search OEM or product"
          resultCount={searching ? searchResults.length : undefined}
          resultLabel="OEM"
        />

        <Select value={categoryFilter} onValueChange={handleCategoryChange}>
          <SelectTrigger className="h-9 w-52"><SelectValue placeholder="OEM" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All OEMs</SelectItem>
            {categoryOptions.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {hasDropdownFilter && (
          <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={clearDropdownFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{[...Array(6)].map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : displayedCategories.length === 0 ? (
        searching ? (
          <EmptyState icon={Package} title={`No results found for "${query}"`} description="Try a different search term." />
        ) : hasDropdownFilter ? (
          <EmptyState icon={Package} title="No matching OEM" description="Try a different OEM filter." />
        ) : (
          <EmptyState icon={Package} title="No OEMs found" description="No products are available yet." />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayedCategories.map(({ name, items, meta }) => {
            const activeCount = items.filter((p) => p.is_active).length
            const inactiveCount = items.length - activeCount
            return (
              <button
                key={name}
                type="button"
                onClick={() => openCategory(name)}
                style={{ '--accent': meta.color, '--accent-tint': meta.tint, '--accent-shade': meta.shade } as React.CSSProperties}
                className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold tracking-wide"
                    style={{ background: meta.tint, color: meta.color }}
                  >
                    {meta.mono}
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: meta.tint, color: meta.color }}>
                    {items.length} {items.length === 1 ? 'product' : 'products'}
                  </span>
                </div>
                <div>
                  <div className="text-[15px] font-semibold tracking-tight text-foreground">{name}</div>
                  <div className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {activeCount} active{inactiveCount > 0 ? ` · ${inactiveCount} inactive` : ''}
                  </div>
                </div>
                <div className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-[var(--accent)]">
                  View products <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Create dialog (managers only) */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Product Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <SearchableSelect
              label="OEM"
              required
              options={oemOptions.map((name) => ({ id: name, label: name }))}
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
              placeholder="Select OEM"
              searchPlaceholder="Search OEMs…"
              emptyText="No matching OEM"
            />
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>

            <div className="space-y-3 rounded-xl border bg-muted/20 p-3.5">
              <Label className="text-sm font-semibold">Product Manager</Label>
              <IconField icon={User} label="Name" value={form.manager.name} onChange={(e) => setForm({ ...form, manager: { ...form.manager, name: e.target.value } })} placeholder="Full name" />
              <IconField icon={Mail} label="Email" type="email" value={form.manager.email} onChange={(e) => setForm({ ...form, manager: { ...form.manager, email: e.target.value } })} placeholder="email@company.com" />
              <div className="grid grid-cols-2 gap-3">
                <IconField icon={Phone} label="Mobile Number" type="tel" value={form.manager.phone} onChange={(e) => setForm({ ...form, manager: { ...form.manager, phone: e.target.value } })} placeholder="+880 …" />
                <IconField icon={Briefcase} label="Designation" value={form.manager.designation} onChange={(e) => setForm({ ...form, manager: { ...form.manager, designation: e.target.value } })} placeholder="Product Manager" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <IconField icon={IdCard} label="Employee ID" value={form.manager.employee_id} onChange={(e) => setForm({ ...form, manager: { ...form.manager, employee_id: e.target.value } })} placeholder="EMP-1024" />
                <IconField icon={CalendarDays} label="Joining Date" type="date" value={form.manager.joining_date} onChange={(e) => setForm({ ...form, manager: { ...form.manager, joining_date: e.target.value } })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={createMutation.isPending || !form.name || !form.category.trim()} onClick={() => createMutation.mutate()}>{createMutation.isPending ? 'Saving...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage OEMs (managers only) */}
      <Dialog open={showManageOem} onOpenChange={setShowManageOem}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage OEMs</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>New OEM Name</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={newOemName}
                  onChange={(e) => setNewOemName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOem() } }}
                  placeholder="e.g. Cisco"
                />
                <Button type="button" disabled={!newOemName.trim()} onClick={addOem}>
                  <PlusCircle className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Current OEMs ({oemOptions.length})</Label>
              <div className="rounded-lg border max-h-64 overflow-y-auto divide-y">
                {oemOptions.map((name) => (
                  <div key={name} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <Factory className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {name}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManageOem(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
