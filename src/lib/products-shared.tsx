'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { Pencil, ArrowRight, Package, ShieldCheck, Network, ShieldAlert, ScanSearch, DatabaseBackup, Cloud, Server, Layers, type LucideIcon } from 'lucide-react'
import type { Product } from '@/types'

const CAROUSEL_INTERVAL_MS = 2800

export type CategoryStyle = { color: string; tint: string; shade: string }
export type CategoryMeta = CategoryStyle & { mono: string; icon: LucideIcon }

export const CATEGORY_PALETTE: CategoryStyle[] = [
  { color: '#16a34a', tint: '#e8f7ee', shade: '#0f7a37' },
  { color: '#2a5fd8', tint: '#e9effc', shade: '#1f49ad' },
  { color: '#7c3aed', tint: '#f1ecfd', shade: '#6025c9' },
  { color: '#d97706', tint: '#fdf3e3', shade: '#b25e04' },
  { color: '#e11d48', tint: '#fdeaef', shade: '#b0173a' },
  { color: '#0891b2', tint: '#e5f6fa', shade: '#066a86' },
  { color: '#059669', tint: '#e6f6f1', shade: '#04754f' },
  { color: '#0d9488', tint: '#e5f5f3', shade: '#096e64' },
]

export const CATEGORY_META: Record<string, CategoryMeta> = {
  'Endpoint & Server Security': { mono: 'ES', icon: ShieldCheck, ...CATEGORY_PALETTE[0] },
  'Network & Gateway Security': { mono: 'NG', icon: Network, ...CATEGORY_PALETTE[1] },
  'Risk & Compliance': { mono: 'RC', icon: ShieldAlert, ...CATEGORY_PALETTE[2] },
  'Vulnerability Assessment': { mono: 'VA', icon: ScanSearch, ...CATEGORY_PALETTE[3] },
  'Data Protection': { mono: 'DP', icon: DatabaseBackup, ...CATEGORY_PALETTE[4] },
  'Virtualization & Cloud': { mono: 'VC', icon: Cloud, ...CATEGORY_PALETTE[5] },
  'Data Center Security': { mono: 'DC', icon: Server, ...CATEGORY_PALETTE[6] },
  'Infrastructure': { mono: 'IN', icon: Layers, ...CATEGORY_PALETTE[7] },
}

export function hashString(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export function getCategoryMeta(name: string): CategoryMeta {
  if (CATEGORY_META[name]) return CATEGORY_META[name]
  const palette = CATEGORY_PALETTE[hashString(name) % CATEGORY_PALETTE.length]
  const mono = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '—'
  return { mono, icon: Package, ...palette }
}

export function accentVars(meta: CategoryStyle): CSSProperties {
  return { '--accent': meta.color, '--accent-tint': meta.tint, '--accent-shade': meta.shade } as CSSProperties
}

export function ProductCard({
  product,
  meta,
  canManage,
  onView,
  onEdit,
}: {
  product: Product
  meta: CategoryMeta
  canManage: boolean
  onView: (product: Product) => void
  onEdit: (e: React.MouseEvent | React.KeyboardEvent, product: Product) => void
}) {
  const Icon = meta.icon
  const images = product.image_urls ?? []
  const [activeImage, setActiveImage] = useState(0)

  useEffect(() => {
    if (images.length < 2) return
    const id = setInterval(() => {
      setActiveImage((i) => (i + 1) % images.length)
    }, CAROUSEL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [images.length])

  const cover = images[activeImage]
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onView(product)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onView(product)}
      style={accentVars(meta)}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-lg"
    >
      <div
        className="relative flex h-28 items-center justify-center overflow-hidden"
        style={cover ? undefined : { background: `linear-gradient(135deg, ${meta.color} 0%, ${meta.shade} 100%)` }}
      >
        {cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={product.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/10" />
          </>
        ) : (
          <>
            <div className="absolute -right-14 -top-16 h-52 w-52 rounded-full bg-white/10" />
            <div className="absolute -bottom-12 -left-8 h-36 w-36 rounded-full border border-white/15" />
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 shadow-inner backdrop-blur-sm">
              <Icon className="h-7 w-7 text-white" />
            </div>
          </>
        )}
        <span className="absolute left-4 top-3 text-[11px] font-semibold tracking-wide text-white/90 drop-shadow">{product.category || 'Other'}</span>
        {canManage && !product.is_active && (
          <span className="absolute right-3.5 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-red-600">Inactive</span>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === activeImage ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[15px] font-semibold leading-snug text-foreground">{product.name}</p>
          {canManage && (
            <button
              type="button"
              onClick={(e) => onEdit(e, product)}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p className="line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">{product.description}</p>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
          <span className="text-[13px] font-semibold text-[var(--accent)]">Details</span>
          <ArrowRight className="h-3.5 w-3.5 text-[var(--accent)] transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
  )
}
