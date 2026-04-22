import { NextRequest, NextResponse } from 'next/server'
import { redis, KEYS, epochMs, requireAuth } from '@/lib/redis'

/**
 * GET /api/sync/pull?since=<ISO timestamp>
 *
 * Returns everything that has changed since the given timestamp.
 * Uses sorted sets (score = epoch ms) for efficient range lookups.
 */

export async function GET(req: NextRequest) {
  const unauthorized = requireAuth(req)
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(req.url)
  const sinceParam = searchParams.get('since') || '1970-01-01T00:00:00.000Z'
  const sinceMs    = epochMs(sinceParam)

  const [bundleUuids, assetUuids, tagUuids, bmUuids, delUuids] = await Promise.all([
    redis.zrange(KEYS.zBundles,     sinceMs, '+inf', { byScore: true }),
    redis.zrange(KEYS.zAssets,      sinceMs, '+inf', { byScore: true }),
    redis.zrange(KEYS.zTags,        sinceMs, '+inf', { byScore: true }),
    redis.zrange(KEYS.zMemberships, sinceMs, '+inf', { byScore: true }),
    redis.zrange(KEYS.zDeletions,   sinceMs, '+inf', { byScore: true })
  ]) as [string[], string[], string[], string[], string[]]

  const [bundles, assets, tags, memberships, deletions] = await Promise.all([
    fetchMany(bundleUuids, KEYS.bundle),
    fetchMany(assetUuids,  KEYS.asset),
    fetchMany(tagUuids,    KEYS.tag),
    fetchMany(bmUuids,     KEYS.membership),
    fetchMany(delUuids,    KEYS.deletion)
  ])

  return NextResponse.json({
    bundles, assets, tags, memberships, deletions,
    server_ts: new Date().toISOString()
  })
}

async function fetchMany(uuids: string[], keyFn: (u: string) => string): Promise<any[]> {
  if (!uuids?.length) return []
  const keys = uuids.map(keyFn)
  const values = (await redis.mget(...keys)) as any[]
  return values.filter(v => v != null)
}
