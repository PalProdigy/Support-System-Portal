'use client'

import { useState } from 'react'
import { MarkdownViewer } from './markdown-viewer'
import { cn } from '@/lib/utils'
import { BookOpen, ChevronDown } from 'lucide-react'

// A bundled asset so the image example renders without any external URL.
// (data: URLs won't work here — the viewer strips them for security.)
const DEMO_IMG = '/globe.svg'

interface GuideRow {
  /** What the user types into the Description box. */
  syntax: string
  /** Optional plain-language note shown under the rendered result. */
  note?: string
  /** Skip live rendering (for notations better explained in words). */
  renderAs?: string
}

interface GuideSection {
  title: string
  rows: GuideRow[]
}

const SECTIONS: GuideSection[] = [
  {
    title: 'Headings',
    rows: [
      {
        syntax: '# Big heading\n## Medium heading\n### Small heading',
        note: 'Start a line with #, ## or ### — more # means a smaller heading.',
      },
    ],
  },
  {
    title: 'Text styles',
    rows: [
      {
        syntax: '**bold** and *italic*\n~~strikethrough~~ and `inline code`',
        note: 'Wrap words in ** for bold, * for italic, ~~ to strike through, backticks (`) for code.',
      },
    ],
  },
  {
    title: 'Lists',
    rows: [
      { syntax: '- Bullet point\n- Another point' },
      { syntax: '1. First step\n2. Second step' },
      {
        syntax: '- [x] Finished task\n- [ ] Pending task',
        note: 'Task lists: [x] is checked, [ ] is unchecked.',
      },
    ],
  },
  {
    title: 'Links & images',
    rows: [
      {
        syntax: '[Open the docs](https://example.com)',
        note: 'Text in [brackets] becomes the link; the (URL) is where it goes.',
      },
      {
        syntax: `![Logo](${DEMO_IMG})`,
        note: 'Same as a link but with ! in front — shows the image from the URL.',
      },
    ],
  },
  {
    title: 'Quotes & dividers',
    rows: [
      { syntax: '> Important note for readers' },
      { syntax: 'Above the line\n\n---\n\nBelow the line', note: '--- on its own line draws a divider.' },
    ],
  },
  {
    title: 'Code blocks',
    rows: [
      {
        syntax: '```js\nconst total = qty * price\n```',
        note: 'Three backticks start and end a code block; add a language (js, py, sql…) for syntax colors.',
      },
    ],
  },
  {
    title: 'Tables',
    rows: [
      {
        syntax: '| Plan | Limit |\n| ---- | ----- |\n| Free | 100/day |\n| Pro  | 10k/day |',
        note: 'Pipes (|) separate columns; the dashes row splits the header from the body.',
      },
    ],
  },
  {
    title: 'New lines',
    rows: [
      {
        syntax: 'First line\nSecond line',
        note: 'Press Enter once for a new line, twice for a new paragraph.',
      },
    ],
  },
]

/**
 * Beginner-friendly markdown manual: every notation is shown as "You type"
 * beside "You get", where the result is rendered by the same MarkdownViewer
 * the live preview uses — so the examples can never drift from reality.
 *
 * The body scrolls inside the card. In a column flex layout the card grows to
 * fill the leftover space while open (flex-1) and collapses to just its
 * header when closed. (A plain div + state instead of <details>: Chromium's
 * internal ::details-content wrapper breaks the flex height chain the
 * internal scrollbar depends on.)
 */
export function MarkdownGuide({ className }: { className?: string }) {
  const [open, setOpen] = useState(true)
  return (
    <div
      id="markdown-guide"
      className={cn('rounded-xl border bg-card min-w-0 lg:flex lg:flex-col lg:min-h-0', open && 'lg:flex-1', className)}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full shrink-0 items-center gap-2 px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
      >
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Markdown guide</span>
        <span className="text-[11px] text-muted-foreground hidden sm:inline">what to type to get each feature</span>
        <ChevronDown className={cn('ml-auto h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
      <div className="border-t px-4 py-3 space-y-4 overflow-y-auto max-h-[60vh] lg:max-h-none lg:flex-1 lg:min-h-0">
        {/* Column headers */}
        <div className="grid grid-cols-2 gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>You type</span>
          <span>You get</span>
        </div>

        {SECTIONS.map((section) => (
          <section key={section.title} className="space-y-2">
            <h4 className="text-xs font-semibold text-foreground">{section.title}</h4>
            {section.rows.map((row) => (
              <div key={row.syntax} className="space-y-1">
                <div className="grid grid-cols-2 gap-3 items-stretch">
                  <pre className="rounded-md bg-muted/60 p-2 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words overflow-x-auto">
                    {row.syntax}
                  </pre>
                  <div className="rounded-md border border-dashed p-2 min-w-0 overflow-x-auto [&_.markdown-body]:text-[13px] [&_.markdown-body_img]:h-8 [&_.markdown-body_img]:w-8">
                    <MarkdownViewer content={row.renderAs ?? row.syntax} />
                  </div>
                </div>
                {row.note && <p className="text-[11px] text-muted-foreground">{row.note}</p>}
              </div>
            ))}
          </section>
        ))}

        <p className="text-[11px] text-muted-foreground border-t pt-2.5">
          Everything renders live in the preview above as you type — raw HTML tags are ignored for safety.
        </p>
      </div>
      )}
    </div>
  )
}
