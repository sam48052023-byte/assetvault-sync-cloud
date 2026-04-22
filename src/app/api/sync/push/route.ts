import { NextRequest, NextResponse } from 'next/server'
import { redis, KEYS, epochMs, requireAuth } from '@/lib/redis'

/**
 * POST /api/sync/push
 *
 * Accepts a batch of local changes and stores them in Redis.
 * Uses sorted sets (keyed by updated_at epoch ms) so /pull can efficiently
 * return "everything changed since timestamp X".
 *
 * Conflict resolution: last-write-wins by updated_at. If an incoming row
 * has an updated_at <= what's already stored, the incoming row is dropped.
 */

interface PushPayload {
  bundles:     any[]
  assets:      any[]
  tags:        any[]
  memberships: any[]
  deletions:   { entity: string; uuid: string; deleted_at: string }[]
  client_ts:   string
}

export async function POST(req: NextRequest) {
  const unauthorized = requireAuth(req)
  if (unauthorized) return unauthorized

  let payload: PushPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  let stored = 0

  // ── Upserts ────────────────────────────────────────────────────────────────
  stored += await upsertBatch(payload.bundles,     KEYS.bundle,     KEYS.zBundles)
  stored += await upsertBatch(payload.assets,      KEYS.asset,      KEYS.zAssets)
  stored += await upsertBatch(payload.tags,        KEYS.tag,        KEYS.zTags)
  stored += await upsertBatch(payload.memberships, KEYS.membership, KEYS.zMemberships)

  // ── Deletions (tombstones) ─────────────────────────────────────────────────
  if (payload.deletions?.length) {
    for (const d of payload.deletions) {
      if (!d.uuid) continue
      const score = epochMs(d.deleted_at)
      await redis.set(KEYS.deletion(d.uuid), { entity: d.entity, uuid: d.uuid, deleted_at: d.deleted_at })
      await redis.zadd(KEYS.zDeletions, { score, member: d.uuid })

      // Remove the live row from its zset so future pulls don't re-ship it
      if (d.entity === 'bundle')          { await redis.zrem(KEYS.zBundles, d.uuid);     await redis.del(KEYS.bundle(d.uuid)) }
      else if (d.entity === 'asset')      { await redis.zrem(KEYS.zAssets, d.uuid);      await redis.del(KEYS.asset(d.uuid)) }
      else if (d.entity === 'tag')        { await redis.zrem(KEYS.zTags, d.uuid);        await redis.del(KEYS.tag(d.uuid)) }
      else if (d.entity === 'membership') { await redis.zrem(KEYS.zMemberships, d.uuid); await redis.del(KEYS.membership(d.uuid)) }

      stored++
    }
  }

  return NextResponse.json({
    ok: true,
    stored,
    server_ts: new Date().toISOString()
  })
}

async function upsertBatch(
  rows: any[] | undefined,
  keyFn: (uuid: string) => string,
  zKey:  string
): Promise<number> {
  if (!rows?.length) return 0
  let count = 0
  for (const row of rows) {
    if (!row?.uuid) continue
    const score = epochMs(row.updated_at)

    // Last-write-wins check
    const existing = (await redis.get(keyFn(row.uuid))) as any
    if (existing && epochMs(existing.updated_at) >= score) continue

    await redis.set(keyFn(row.uuid), row)
    await redis.zadd(zKey, { score, member: row.uuid })
    count++
  }
  return count
}
