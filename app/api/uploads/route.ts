import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

// POST /api/uploads — image upload endpoint used by the article editor.
// Accepts multipart/form-data with a `file` field, validates it strictly
// (allow-list of image types, size cap, magic-byte sniffing) and stores the
// file under <project>/uploads with a random name. Returns { url }.
//
// Files are served back by GET /api/uploads/[filename] — they intentionally
// do NOT live in public/, because `next start` serves public/ from a
// build-time snapshot and would 404 anything uploaded at runtime.
//
// The markdown then references the returned URL — Base64 images are never
// stored. When a real backend/object store exists, only this route (or the
// uploadImage() helper's endpoint) needs to change.

export const runtime = 'nodejs'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

// SVG is intentionally excluded: it can carry scripts (XSS via <img> is safe,
// but direct navigation to the file would execute them).
const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

// Verify the file really is what its MIME type claims (magic bytes).
function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif'
  const ascii = (start: number, len: number) => String.fromCharCode(...bytes.slice(start, start + len))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp'
  return null
}

export async function POST(request: Request) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing "file" field' }, { status: 400 })
  }
  if (file.size === 0) {
    return Response.json({ error: 'The file is empty' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'Image is too large (max 5 MB)' }, { status: 413 })
  }
  if (!ALLOWED[file.type]) {
    return Response.json({ error: 'Unsupported image type. Use PNG, JPEG, WebP or GIF.' }, { status: 415 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const sniffed = sniffImageType(bytes)
  if (sniffed !== file.type) {
    return Response.json({ error: 'File content does not match its declared image type' }, { status: 415 })
  }

  // Random server-generated name — never trust the client-provided filename.
  const filename = `${crypto.randomUUID()}.${ALLOWED[file.type]}`
  const dir = path.join(process.cwd(), 'uploads')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, filename), bytes)

  return Response.json({ url: `/api/uploads/${filename}` }, { status: 201 })
}
