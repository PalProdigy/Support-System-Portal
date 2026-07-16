'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { List } from 'lucide-react'
import type { MarkdownHeading } from '@/lib/markdown/utils'

/**
 * Table of contents built from the article's headings (h2/h3 level detail).
 * Ids match rehype-slug's anchors, so clicking smooth-scrolls to the section;
 * an IntersectionObserver highlights the section currently in view.
 */
export function TableOfContents({ headings, className }: { headings: MarkdownHeading[]; className?: string }) {
  // Top-level structure: keep h1–h3, drop deeper levels to keep the rail scannable.
  const items = headings.filter((h) => h.depth <= 3)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (items.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost heading currently intersecting the reading band.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      // Reading band: a strip near the top of the viewport.
      { rootMargin: '-64px 0px -70% 0px', threshold: 0 },
    )
    for (const h of items) {
      const el = document.getElementById(h.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
    // items is derived from headings; re-observe when the document changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headings])

  if (items.length === 0) return null

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(id)
  }

  return (
    <nav aria-label="Table of contents" className={cn('text-sm', className)}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        <List className="h-3.5 w-3.5" /> On this page
      </p>
      <ul className="space-y-0.5 border-l">
        {items.map((h) => (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => scrollTo(h.id)}
              className={cn(
                'block w-full truncate border-l-2 -ml-px py-1 pr-2 text-left text-[13px] leading-snug transition-colors',
                h.depth <= 1 ? 'pl-3' : h.depth === 2 ? 'pl-3' : 'pl-6',
                activeId === h.id
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {h.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
