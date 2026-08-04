'use client'

import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { IconField } from '@/components/shared/icon-field'
import { toast } from '@/hooks/use-toast'
import { formatBytes } from '@/lib/utils'
import { ImagePlus, X, Loader2, FolderKanban, User, Mail, Phone, Briefcase, IdCard, CalendarDays } from 'lucide-react'
import { accentVars, getCategoryMeta } from '@/lib/products-shared'
import type { Product } from '@/types'

const IMG_MAX = 2 * 1024 * 1024 // 2 MB, kept small so it persists comfortably in local storage
const MAX_IMAGES = 5

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Add and edit use the same layout/fields — only the submit action and
// initial values differ, so one dialog covers both flows. The caller must
// mount this conditionally on `open` (see ProductCategoryPage) so each open
// gets a fresh instance — that's what seeds the form via useState instead of
// an effect.
export function ProductFormDialog({ mode, category, product, open, onOpenChange }: {
  mode: 'create' | 'edit'
  category: string
  product?: Product
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const dp = getDataProvider()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const meta = getCategoryMeta(category)

  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [images, setImages] = useState<string[]>(product?.image_urls ?? [])
  const [dragOver, setDragOver] = useState(false)

  // Product manager — the OEM/vendor-side point of contact for this product.
  const [managerName, setManagerName] = useState(product?.manager?.name ?? '')
  const [managerEmail, setManagerEmail] = useState(product?.manager?.email ?? '')
  const [managerPhone, setManagerPhone] = useState(product?.manager?.phone ?? '')
  const [managerDesignation, setManagerDesignation] = useState(product?.manager?.designation ?? '')
  const [managerEmployeeId, setManagerEmployeeId] = useState(product?.manager?.employee_id ?? '')
  const [managerJoiningDate, setManagerJoiningDate] = useState(product?.manager?.joining_date ?? '')

  async function onPickImages(fileList?: FileList | File[] | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) { toast({ title: `You can upload up to ${MAX_IMAGES} images`, variant: 'destructive' }); return }

    const accepted: string[] = []
    for (const file of files) {
      if (accepted.length >= remaining) break
      if (!file.type.startsWith('image/')) { toast({ title: 'Please choose an image file', variant: 'destructive' }); continue }
      if (file.size > IMG_MAX) { toast({ title: `Image exceeds ${formatBytes(IMG_MAX)}`, variant: 'destructive' }); continue }
      accepted.push(await fileToDataUrl(file))
    }
    if (files.length > remaining) toast({ title: `Only ${remaining} more image${remaining === 1 ? '' : 's'} could be added`, description: `Products can have up to ${MAX_IMAGES} images.`, variant: 'destructive' })
    if (accepted.length) setImages((prev) => [...prev, ...accepted])
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const manager = managerName.trim()
    ? {
        name: managerName.trim(),
        email: managerEmail.trim(),
        phone: managerPhone.trim(),
        designation: managerDesignation.trim(),
        employee_id: managerEmployeeId.trim(),
        joining_date: managerJoiningDate,
      }
    : undefined

  const saveMutation = useMutation({
    mutationFn: () => mode === 'edit' && product
      ? dp.updateProduct(product.id, {
          name: name.trim(),
          description: description.trim(),
          image_urls: images.length ? images : undefined,
          manager,
        })
      : dp.createProduct({
          name: name.trim(),
          description: description.trim(),
          category,
          is_active: true,
          image_urls: images.length ? images : undefined,
          manager,
        }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast({ title: mode === 'edit' ? 'Product updated' : 'Product added', variant: 'success' })
      onOpenChange(false)
    },
    onError: () => toast({
      title: mode === 'edit' ? 'Could not update product' : 'Could not add product',
      description: 'The image may be too large to store.',
      variant: 'destructive',
    }),
  })

  const isEdit = mode === 'edit'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Product' : 'Add Product'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <FolderKanban className="h-3.5 w-3.5" />
            {isEdit ? 'Category' : 'Adding to'}
            <Badge variant="secondary" style={{ background: meta.tint, color: meta.color }} className="font-medium">
              {category}
            </Badge>
          </div>

          {/* Image upload */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Product Images</Label>
              <span className="text-xs text-muted-foreground">{images.length}/{MAX_IMAGES}</span>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {images.map((src, index) => (
                  <div key={index} className="group relative aspect-square overflow-hidden rounded-lg border border-border" style={accentVars(meta)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Product preview ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); onPickImages(e.dataTransfer.files) }}
                className={`flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50'}`}
              >
                <div className="rounded-full bg-primary/10 p-2">
                  <ImagePlus className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground">Up to {MAX_IMAGES} images · PNG or JPG, {formatBytes(IMG_MAX)} each</p>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => { onPickImages(e.target.files); e.target.value = '' }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Endpoint Protection Suite" />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="A short description of this product…" />
          </div>

          <div className="space-y-3 rounded-xl border bg-muted/20 p-3.5">
            <Label className="text-sm font-semibold">Product Manager</Label>
            <IconField icon={User} label="Name" value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="Full name" />
            <IconField icon={Mail} label="Email" type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} placeholder="email@company.com" />
            <div className="grid grid-cols-2 gap-3">
              <IconField icon={Phone} label="Mobile Number" type="tel" value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)} placeholder="+880 …" />
              <IconField icon={Briefcase} label="Designation" value={managerDesignation} onChange={(e) => setManagerDesignation(e.target.value)} placeholder="Product Manager" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <IconField icon={IdCard} label="Employee ID" value={managerEmployeeId} onChange={(e) => setManagerEmployeeId(e.target.value)} placeholder="EMP-1024" />
              <IconField icon={CalendarDays} label="Joining Date" type="date" value={managerJoiningDate} onChange={(e) => setManagerJoiningDate(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saveMutation.isPending || !name.trim()} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : isEdit ? 'Save Changes' : 'Add Product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
