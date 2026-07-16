'use client'

import { memo, useCallback, useState, type HTMLAttributes, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import type { Element, ElementContent } from 'hast'

// Human-friendly names for the language badge; anything unknown falls back to
// the raw language id (or "text" when the fence has no language).
const LANGUAGE_LABELS: Record<string, string> = {
  ts: 'TypeScript', typescript: 'TypeScript', tsx: 'TSX',
  js: 'JavaScript', javascript: 'JavaScript', jsx: 'JSX',
  json: 'JSON', bash: 'Bash', sh: 'Shell', shell: 'Shell', zsh: 'Shell',
  sql: 'SQL', java: 'Java', py: 'Python', python: 'Python',
  html: 'HTML', css: 'CSS', xml: 'XML', yaml: 'YAML', yml: 'YAML',
  md: 'Markdown', markdown: 'Markdown', diff: 'Diff', text: 'Text', txt: 'Text', plaintext: 'Text',
}

/** Collects the raw text of a hast subtree — used for the copy button. */
function extractText(node: ElementContent | Element | undefined): string {
  if (!node) return ''
  if (node.type === 'text') return node.value
  if ('children' in node) return node.children.map(extractText).join('')
  return ''
}

function languageFromClassName(className: unknown): string | null {
  if (typeof className === 'string') {
    const match = /(?:^|\s)language-([\w+-]+)/.exec(className)
    if (match) return match[1]
  }
  if (Array.isArray(className)) {
    for (const cls of className) {
      const found = languageFromClassName(cls)
      if (found) return found
    }
  }
  return null
}

interface CodeBlockProps extends HTMLAttributes<HTMLPreElement> {
  /** hast node injected by react-markdown — source of copy text + language. */
  node?: Element
  children?: ReactNode
}

/**
 * Replaces react-markdown's default <pre> renderer: language badge, copy
 * button, horizontal scrolling and rounded chrome. Highlighted token spans
 * (from rehype-highlight) are passed through untouched as children.
 */
export const CodeBlock = memo(function CodeBlock({ node, children, ...rest }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const codeElement = node?.children.find(
    (c): c is Element => c.type === 'element' && c.tagName === 'code',
  )
  const language = languageFromClassName(codeElement?.properties?.className) ?? 'text'
  const label = LANGUAGE_LABELS[language.toLowerCase()] ?? language

  const handleCopy = useCallback(async () => {
    const text = extractText(codeElement).replace(/\n$/, '')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (permissions/insecure context) — leave state as-is.
    }
  }, [codeElement])

  return (
    <div className="markdown-code-block group/code">
      <div className="flex items-center justify-between border-b bg-muted/60 px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground select-none">
          {label}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy code to clipboard'}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copied
            ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied</>
            : <><Copy className="h-3.5 w-3.5" /> Copy</>}
        </button>
      </div>
      <pre {...rest}>{children}</pre>
    </div>
  )
})
