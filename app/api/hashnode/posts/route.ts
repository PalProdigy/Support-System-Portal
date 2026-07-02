import { listHashnodePosts, isHashnodeConfigured } from '@/lib/hashnode'

// GET /api/hashnode/posts — solution articles from the org's Hashnode publication.
// Returns { configured: false } (not an error) when no publication host is set,
// so the UI can hide the section instead of showing a failure state.
export async function GET() {
  if (!isHashnodeConfigured()) {
    return Response.json({ configured: false, posts: [] })
  }
  try {
    const posts = await listHashnodePosts()
    return Response.json({ configured: true, posts })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to load Hashnode posts' },
      { status: 502 },
    )
  }
}