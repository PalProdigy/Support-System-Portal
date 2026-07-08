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
import { toast } from '@/hooks/use-toast'
import { formatBytes } from '@/lib/utils'
import { ImagePlus, X, Loader2, FolderKanban } from 'lucide-react'
import { accentVars, getCategoryMeta } from '@/lib/products-shared'
import type { Product } from '@/types'

const IMG_MAX = 2 * 1024 * 1024 // 2 MB, kept small so it persists comfortably in local storage

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
  const [image, setImage] = useState(product?.image_url ?? '')
  const [dragOver, setDragOver] = useState(false)

  async function onPickImage(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast({ title: 'Please choose an image file', variant: 'destructive' }); return }
    if (file.size > IMG_MAX) { toast({ title: `Image exceeds ${formatBytes(IMG_MAX)}`, variant: 'destructive' }); return }
    setImage(await fileToDataUrl(file))
  }

  const saveMutation = useMutation({
    mutationFn: () => mode === 'edit' && product
      ? dp.updateProduct(product.id, {
          name: name.trim(),
          description: description.trim(),
          image_url: image || undefined,
        })
      : dp.createProduct({
          name: name.trim(),
          description: description.trim(),
          category,
          is_active: true,
          image_url: image || undefined,
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
            <Label>Product Image</Label>
            {image ? (
              <div className="group relative h-40 w-full overflow-hidden rounded-xl border border-border" style={accentVars(meta)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="Product preview" className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                  <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>Change</Button>
                  <Button type="button" size="sm" variant="destructive" onClick={() => setImage('')}>
                    <X className="h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); onPickImage(e.dataTransfer.files?.[0]) }}
                className={`flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50'}`}
              >
                <div className="rounded-full bg-primary/10 p-2.5">
                  <ImagePlus className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground">PNG or JPG, up to {formatBytes(IMG_MAX)}</p>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => onPickImage(e.target.files?.[0] ?? undefined)}
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
