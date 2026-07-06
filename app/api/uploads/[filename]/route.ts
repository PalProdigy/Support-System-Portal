import { readFile } from 'fs/promises'
import path from 'path'

// GET /api/uploads/:filename — serves images stored by POST /api/uploads.
// Filenames are server-generated UUIDs, so the strict pattern below both
// authenticates the name shape and rules out path traversal.

export const runtime = 'nodejs'

const FILENAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif)$/

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params
  if (!FILENAME_PATTERN.test(filename)) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const bytes = await readFile(path.join(process.cwd(), 'uploads', filename))
    const ext = filename.slice(filename.lastIndexOf('.') + 1)
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': CONTENT_TYPES[ext],
        // Names are random and content never changes — cache forever.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
}
