// Hashnode headless-CMS client (server-side only — called from route handlers).
// Solution articles are authored on the org's Hashnode publication and rendered
// by this frontend; the publication host is configured via HASHNODE_PUBLICATION_HOST
// (e.g. "myorg.hashnode.dev") and an optional HASHNODE_ACCESS_TOKEN unlocks
// higher rate limits / private publications.

const HASHNODE_GQL_ENDPOINT = 'https://gql.hashnode.com'

export interface HashnodeTag {
  name: string
  slug: string
}

export interface HashnodePostSummary {
  id: string
  slug: string
  title: string
  brief: string
  url: string
  publishedAt: string
  readTimeInMinutes: number
  coverImageUrl: string | null
  authorName: string
  authorPhotoUrl: string | null
  tags: HashnodeTag[]
}

export interface HashnodePostDetail extends HashnodePostSummary {
  updatedAt: string | null
  contentHtml: string
}

export function isHashnodeConfigured(): boolean {
  return !!process.env.HASHNODE_PUBLICATION_HOST
}

async function hashnodeQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  // Hashnode expects the raw personal access token (no "Bearer" prefix).
  if (process.env.HASHNODE_ACCESS_TOKEN) headers.Authorization = process.env.HASHNODE_ACCESS_TOKEN

  const res = await fetch(HASHNODE_GQL_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Hashnode API responded with ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(`Hashnode API error: ${json.errors[0]?.message ?? 'unknown'}`)
  return json.data as T
}

// Raw GraphQL node shapes (only the fields we select)
interface RawPostNode {
  id: string
  slug: string
  title: string
  brief: string
  url: string
  publishedAt: string
  updatedAt?: string | null
  readTimeInMinutes: number
  coverImage: { url: string } | null
  author: { name: string; profilePicture: string | null }
  tags: HashnodeTag[] | null
  content?: { html: string }
}

function toSummary(node: RawPostNode): HashnodePostSummary {
  return {
    id: node.id,
    slug: node.slug,
    title: node.title,
    brief: node.brief,
    url: node.url,
    publishedAt: node.publishedAt,
    readTimeInMinutes: node.readTimeInMinutes,
    coverImageUrl: node.coverImage?.url ?? null,
    authorName: node.author?.name ?? 'Unknown',
    authorPhotoUrl: node.author?.profilePicture ?? null,
    tags: node.tags ?? [],
  }
}

const LIST_POSTS_QUERY = `
  query SolutionPosts($host: String!, $first: Int!, $after: String) {
    publication(host: $host) {
      posts(first: $first, after: $after) {
        edges {
          node {
            id slug title brief url publishedAt readTimeInMinutes
            coverImage { url }
            author { name profilePicture }
            tags { name slug }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`

// Fetches up to `max` most-recent posts, following pagination (Hashnode caps
// page size at 50). Solution catalogs are small, so a modest cap is plenty.
export async function listHashnodePosts(max = 50): Promise<HashnodePostSummary[]> {
  const host = process.env.HASHNODE_PUBLICATION_HOST
  if (!host) return []

  const posts: HashnodePostSummary[] = []
  let after: string | null = null
  while (posts.length < max) {
    const pageSize = Math.min(50, max - posts.length)
    const data: {
      publication: {
        posts: {
          edges: { node: RawPostNode }[]
          pageInfo: { hasNextPage: boolean; endCursor: string | null }
        }
      } | null
    } = await hashnodeQuery(LIST_POSTS_QUERY, { host, first: pageSize, after })

    const connection = data.publication?.posts
    if (!connection) break
    posts.push(...connection.edges.map((e) => toSummary(e.node)))
    if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) break
    after = connection.pageInfo.endCursor
  }
  return posts
}

const GET_POST_QUERY = `
  query SolutionPost($host: String!, $slug: String!) {
    publication(host: $host) {
      post(slug: $slug) {
        id slug title brief url publishedAt updatedAt readTimeInMinutes
        coverImage { url }
        author { name profilePicture }
        tags { name slug }
        content { html }
      }
    }
  }
`

export async function getHashnodePost(slug: string): Promise<HashnodePostDetail | null> {
  const host = process.env.HASHNODE_PUBLICATION_HOST
  if (!host) return null

  const data: { publication: { post: RawPostNode | null } | null } =
    await hashnodeQuery(GET_POST_QUERY, { host, slug })

  const node = data.publication?.post
  if (!node) return null
  return {
    ...toSummary(node),
    updatedAt: node.updatedAt ?? null,
    contentHtml: node.content?.html ?? '',
  }
}