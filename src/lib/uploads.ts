// Client-side image upload helper — the single place the UI goes through to
// turn a File into a URL usable inside markdown. Swapping to a real backend
// or object store means changing only this module (and/or the API route).

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // keep in sync with /api/uploads
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

const UPLOAD_ENDPOINT = '/api/uploads'

export class ImageUploadError extends Error {}

/**
 * Uploads an image and resolves with its public URL.
 * Validates locally first so obvious problems fail without a round-trip.
 */
export async function uploadImage(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new ImageUploadError('Unsupported image type. Use PNG, JPEG, WebP or GIF.')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageUploadError('Image is too large (max 5 MB).')
  }

  const form = new FormData()
  form.append('file', file)

  let res: Response
  try {
    res = await fetch(UPLOAD_ENDPOINT, { method: 'POST', body: form })
  } catch {
    throw new ImageUploadError('Upload failed — check your connection and try again.')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ImageUploadError(body?.error ?? `Upload failed (${res.status})`)
  }

  const { url } = (await res.json()) as { url: string }
  return url
}
