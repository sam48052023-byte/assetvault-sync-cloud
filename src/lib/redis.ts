/**
 * Upstash Redis client + auth middleware for the AssetVault sync cloud.
 *
 * Auth: every request must include `Authorization: Bearer <SYNC_API_KEY>`.
 * The key is set as an environment variable in Vercel.
 */

import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'

// Uses UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN from env by default.
export const redis = Redis.fromEnv()

export const KEYS = {
  bundle:      (uuid: string) => `av:bundle:${uuid}`,
  asset:       (uuid: string) => `av:asset:${uuid}`,
  tag:         (uuid: string) => `av:tag:${uuid}`,
  membership:  (uuid: string) => `av:bm:${uuid}`,
  deletion:    (uuid: string) => `av:del:${uuid}`,

  // Sorted sets: score = updated_at epoch ms, member = uuid.
  // Used by /pull to efficiently fetch "everything changed since X".
  zBundles:      'av:z:bundles',
  zAssets:       'av:z:assets',
  zTags:         'av:z:tags',
  zMemberships:  'av:z:bm',
  zDeletions:    'av:z:del',
}

export function epochMs(isoOrDate: string | Date | undefined | null): number {
  if (!isoOrDate) return Date.now()
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  const ms = d.getTime()
  return Number.isFinite(ms) ? ms : Date.now()
}

export function requireAuth(req: NextRequest): NextResponse | null {
  const expected = process.env.SYNC_API_KEY
  if (!expected) {
    return NextResponse.json(
      { error: 'Server misconfigured: SYNC_API_KEY not set' },
      { status: 500 }
    )
  }
  const header = req.headers.get('authorization') || ''
  const match  = header.match(/^Bearer\s+(.+)$/i)
  if (!match || match[1] !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
