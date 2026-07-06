'use client'

import { useMemo } from 'react'
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  toolbarPlugin,
  // toolbar controls
  UndoRedo,
  BoldItalicUnderlineToggles,
  StrikeThroughSupSubToggles,
  CodeToggle,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  InsertCodeBlock,
  DiffSourceToggleWrapper,
  ConditionalContents,
  ChangeCodeMirrorLanguage,
  Separator,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import './editor.css'
import { cn } from '@/lib/utils'
import { useIsDarkMode } from '@/hooks/use-dark-mode'
import { uploadImage } from '@/lib/uploads'

// Languages offered in the code-block language picker. Keys are the markdown
// fence identifiers (also what rehype-highlight sees on the reading side).
const CODE_BLOCK_LANGUAGES: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TSX',
  js: 'JavaScript',
  jsx: 'JSX',
  json: 'JSON',
  bash: 'Bash',
  sql: 'SQL',
  java: 'Java',
  python: 'Python',
  html: 'HTML',
  css: 'CSS',
  xml: 'XML',
  yaml: 'YAML',
  txt: 'Plain text',
  '': 'Unspecified',
}

export interface MarkdownEditorProps {
  /** Initial markdown — read once on mount (remount with `key` to reset). */
  markdown: string
  onChange: (markdown: string) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  /**
   * Turns a dropped/pasted/picked image File into a URL. Defaults to the
   * app's upload endpoint; the resulting URL is inserted as ![](url) —
   * markdown never contains Base64 payloads.
   */
  imageUploadHandler?: (image: File) => Promise<string>
}

/**
 * Hashnode-style WYSIWYG markdown editor (MDXEditor under the hood).
 *
 * Import this component with `next/dynamic` and `ssr: false` — MDXEditor is
 * client-only. What it supports out of the box here: H1–H6, bold/italic/
 * underline/strikethrough, inline code, CodeMirror-backed code blocks,
 * ordered/bullet/task lists, tables, quotes, horizontal rules, links,
 * image upload + paste + drag-and-drop, undo/redo, markdown keyboard
 * shortcuts, and a source/diff view toggle.
 */
export function MarkdownEditor({
  markdown,
  onChange,
  placeholder = 'Start writing… Markdown shortcuts work: # heading, **bold**, `code`, - list',
  autoFocus = false,
  className,
  imageUploadHandler = uploadImage,
}: MarkdownEditorProps) {
  const isDark = useIsDarkMode()

  const plugins = useMemo(() => [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    thematicBreakPlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    imagePlugin({
      imageUploadHandler,
      // Resizing writes width/height as inline HTML — keep the markdown pure.
      disableImageResize: true,
    }),
    tablePlugin(),
    codeBlockPlugin({ defaultCodeBlockLanguage: 'ts' }),
    codeMirrorPlugin({ codeBlockLanguages: CODE_BLOCK_LANGUAGES }),
    diffSourcePlugin({ viewMode: 'rich-text' }),
    toolbarPlugin({
      toolbarContents: () => (
        <ConditionalContents
          options={[
            {
              // Inside a code block the regular controls don't apply — show
              // the language picker instead.
              when: (editor) => editor?.editorType === 'codeblock',
              contents: () => <ChangeCodeMirrorLanguage />,
            },
            {
              fallback: () => (
                <DiffSourceToggleWrapper>
                  <UndoRedo />
                  <Separator />
                  <BoldItalicUnderlineToggles />
                  <CodeToggle />
                  <StrikeThroughSupSubToggles options={['Strikethrough']} />
                  <Separator />
                  <BlockTypeSelect />
                  <Separator />
                  <ListsToggle />
                  <Separator />
                  <CreateLink />
                  <InsertImage />
                  <Separator />
                  <InsertTable />
                  <InsertCodeBlock />
                  <InsertThematicBreak />
                </DiffSourceToggleWrapper>
              ),
            },
          ]}
        />
      ),
    }),
    // Last so it layers shortcuts over everything registered above.
    markdownShortcutPlugin(),
  ], [imageUploadHandler])

  return (
    <MDXEditor
      className={cn('nhq-editor', isDark && 'dark-theme', className)}
      markdown={markdown}
      onChange={onChange}
      placeholder={placeholder}
      autoFocus={autoFocus}
      suppressHtmlProcessing
      plugins={plugins}
    />
  )
}

export default MarkdownEditor
