import { NextRequest, NextResponse } from 'next/server'
import { redis, KEYS, requireAuth } from '@/lib/redis'

/**
 * POST /api/sync/clear
 *
 * Emergency wipe of ALL sync data in Redis.
 * Requires: Authorization: Bearer <SYNC_API_KEY>
 * Requires: JSON body { confirm: "YES-DELETE-ALL" }
 *
 * Does NOT touch your local SQLite database.
 * After clearing, your next push will re-populate the cloud from scratch.
 */

export async function POST(req: NextRequest) {
  const unauthorized = requireAuth(req)
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => ({} as any))
  if (body.confirm !== 'YES-DELETE-ALL') {
    return NextResponse.json({
      error: 'Confirmation required. Send { "confirm": "YES-DELETE-ALL" } in the body.'
    }, { status: 400 })
  }

  // Delete all sorted sets first, then all individual keys via pattern scan.
  await Promise.all([
    redis.del(KEYS.zBundles),
    redis.del(KEYS.zAssets),
    redis.del(KEYS.zTags),
    redis.del(KEYS.zMemberships),
    redis.del(KEYS.zDeletions)
  ])

  let deleted = 0
  let cursor: string | number = 0
  do {
    const [next, keys] = (await redis.scan(cursor, { match: 'av:*', count: 500 })) as [string, string[]]
    if (keys.length > 0) {
      await redis.del(...keys)
      deleted += keys.length
    }
    cursor = next
  } while (cursor !== '0' && cursor !== 0)

  return NextResponse.json({
    ok: true,
    deleted,
    server_ts: new Date().toISOString()
  })
}
