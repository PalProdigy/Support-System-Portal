import { getHashnodePost, isHashnodeConfigured } from '@/lib/hashnode'

// GET /api/hashnode/posts/:slug — one solution article with full HTML content.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  if (!isHashnodeConfigured()) {
    return Response.json({ error: 'Hashnode is not configured' }, { status: 404 })
  }
  try {
    const post = await getHashnodePost(slug)
    if (!post) return Response.json({ error: 'Article not found' }, { status: 404 })
    return Response.json({ post })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to load the article' },
      { status: 502 },
    )
  }
}