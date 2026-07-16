'use client'

import { memo, type AnchorHTMLAttributes, type HTMLAttributes, type ImgHTMLAttributes } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import type { PluggableList } from 'unified'
import { cn } from '@/lib/utils'
import { CodeBlock } from './code-block'
import './markdown.css'

// Single rendering pipeline for the whole app: the article page and the
// editor's live preview both use this component, so what you see while
// writing is exactly what readers get.
//
// Security: raw HTML inside markdown is NOT rendered (react-markdown skips it
// unless rehype-raw is added — don't add it without a sanitizer), and
// javascript:/data: URLs are stripped by react-markdown's default urlTransform.

// Module-scope plugin arrays — stable references, so memoized re-renders skip
// re-configuring the processor.
const REMARK_PLUGINS: PluggableList = [remarkGfm, remarkBreaks]

const REHYPE_PLUGINS: PluggableList = [
  rehypeSlug,
  [rehypeAutolinkHeadings, {
    behavior: 'append',
    properties: { className: 'heading-anchor', 'aria-label': 'Link to this section' },
    content: { type: 'text', value: '#' },
  }],
  [rehypeHighlight, { detect: false }],
]

function isExternalHref(href?: string): boolean {
  return !!href && /^https?:\/\//i.test(href)
}

const COMPONENTS: Components = {
  // Fenced code blocks get the full CodeBlock chrome (copy button, badge).
  pre: (props) => <CodeBlock {...props} />,
  // Tables scroll horizontally inside their own container on small screens.
  table: ({ node: _node, ...props }: HTMLAttributes<HTMLTableElement> & { node?: unknown }) => (
    <div className="markdown-table-wrap">
      <table {...props} />
    </div>
  ),
  // External links open in a new tab; internal/anchor links stay in-app.
  a: ({ node: _node, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) => (
    <a
      href={href}
      {...(isExternalHref(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...props}
    />
  ),
  // Lazy-load article images; alt text comes from the markdown itself.
  img: ({ node: _node, alt, ...props }: ImgHTMLAttributes<HTMLImageElement> & { node?: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element -- user-authored image, dimensions unknown
    <img loading="lazy" decoding="async" alt={alt ?? ''} {...props} />
  ),
}

export interface MarkdownViewerProps {
  content: string
  className?: string
}

/**
 * Renders markdown (GFM + line breaks + syntax highlighting + heading
 * anchors) with the app's article typography. Memoized: re-renders only when
 * the markdown string actually changes, which keeps live preview cheap.
 */
export const MarkdownViewer = memo(function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  return (
    <div className={cn('markdown-body', className)}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={COMPONENTS}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
