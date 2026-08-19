'use client'

import { useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ProductManagerField } from '@/components/shared/product-manager-field'
import { toast } from '@/hooks/use-toast'
import { formatBytes } from '@/lib/utils'
import { ImagePlus, X, Loader2, FolderKanban } from 'lucide-react'
import { accentVars, getCategoryMeta, collectManagerCandidates } from '@/lib/products-shared'
import type { Product, ProductManager } from '@/types'

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

  // Product managers — the OEM/vendor-side points of contact for this product.
  const [managers, setManagers] = useState<ProductManager[]>(product?.managers ?? [])
  const { data: allProducts } = useQuery({ queryKey: ['products'], queryFn: () => dp.listProducts() })
  const managerCandidates = collectManagerCandidates(allProducts ?? [])

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

  const saveMutation = useMutation({
    mutationFn: () => mode === 'edit' && product
      ? dp.updateProduct(product.id, {
          name: name.trim(),
          description: description.trim(),
          image_urls: images.length ? images : undefined,
          managers: managers.length ? managers : undefined,
        })
      : dp.createProduct({
          name: name.trim(),
          description: description.trim(),
          category,
          is_active: true,
          image_urls: images.length ? images : undefined,
          managers: managers.length ? managers : undefined,
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
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-50 grid w-full max-h-[85vh] gap-3 overflow-y-auto rounded-t-2xl border-t bg-background p-3 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-w-lg sm:max-h-[90vh] sm:-translate-x-[50%] sm:-translate-y-[50%] sm:rounded-lg sm:border sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]"
        >
          {/* Grab-handle affordance for the mobile bottom sheet */}
          <div className="mx-auto -mt-0.5 mb-0.5 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25 sm:hidden" />

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

            <ProductManagerField managers={managers} onChange={setManagers} candidates={managerCandidates} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={saveMutation.isPending || !name.trim()} onClick={() => saveMutation.mutate()} style={{ background: meta.color }}>
              {saveMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : isEdit ? 'Save Changes' : 'Add Product'}
            </Button>
          </DialogFooter>

          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
