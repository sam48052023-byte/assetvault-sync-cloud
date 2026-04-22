import { NextRequest, NextResponse } from 'next/server'
import { redis, KEYS, requireAuth } from '@/lib/redis'

/**
 * GET /api/sync/status
 *
 * Returns a healthcheck + current counts of stored entities.
 * Useful for verifying the cloud is reachable and your data made it across.
 */

export async function GET(req: NextRequest) {
  const unauthorized = requireAuth(req)
  if (unauthorized) return unauthorized

  try {
    const [bundles, assets, tags, memberships, deletions] = await Promise.all([
      redis.zcard(KEYS.zBundles),
      redis.zcard(KEYS.zAssets),
      redis.zcard(KEYS.zTags),
      redis.zcard(KEYS.zMemberships),
      redis.zcard(KEYS.zDeletions)
    ])

    return NextResponse.json({
      ok:        true,
      server_ts: new Date().toISOString(),
      counts:    { bundles, assets, tags, memberships, deletions }
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
