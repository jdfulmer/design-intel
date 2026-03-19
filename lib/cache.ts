// lib/cache.ts — Vercel KV cache layer (1hr TTL)
// Falls back gracefully if KV is not configured (e.g. local dev without KV)

import { kv } from "@vercel/kv";

const TTL_SECONDS = 60 * 60; // 1 hour
const SYNC_TTL_SECONDS = 60 * 60 * 24; // 24 hours for sync data
const SNAPSHOT_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days for weekly snapshots
const COMPLETED_TTL_SECONDS = 60 * 60 * 6; // 6 hours for completed tasks

export type CacheKey =
  | `figma:team-activity:${string}`  // figma:team-activity:1234567890:1234567890
  | "figma:latest-sync"             // latest sync result from /api/figma/sync
  | `asana:tasks:${string}`          // asana:tasks:all or asana:tasks:2026-03-04
  | `asana:completed:${string}`      // asana:completed:2026-03-18
  | `snapshot:week:${string}`        // snapshot:week:2026-03-16 (Monday date)
  | "cache:timestamps";

export interface CacheTimestamps {
  figma?: string;  // ISO string of last successful fetch
  asana?: string;
}

function isKVConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export async function cacheGet<T>(key: CacheKey): Promise<T | null> {
  if (!isKVConfigured()) return null;
  try {
    return await kv.get<T>(key);
  } catch (e) {
    console.warn(`[cache] get failed for ${key}:`, e);
    return null;
  }
}

export async function cacheSet<T>(key: CacheKey, value: T): Promise<void> {
  if (!isKVConfigured()) return;
  let ttl = TTL_SECONDS;
  if (key === "figma:latest-sync") ttl = SYNC_TTL_SECONDS;
  else if (key.startsWith("snapshot:week:")) ttl = SNAPSHOT_TTL_SECONDS;
  else if (key.startsWith("asana:completed:")) ttl = COMPLETED_TTL_SECONDS;
  try {
    await kv.set(key, value, { ex: ttl });
  } catch (e) {
    console.warn(`[cache] set failed for ${key}:`, e);
  }
}

export async function cacheDel(key: CacheKey): Promise<void> {
  if (!isKVConfigured()) return;
  try {
    await kv.del(key);
  } catch (e) {
    console.warn(`[cache] del failed for ${key}:`, e);
  }
}

export async function cacheSetWithTTL<T>(key: CacheKey, value: T, ttlSeconds: number): Promise<void> {
  if (!isKVConfigured()) return;
  try {
    await kv.set(key, value, { ex: ttlSeconds });
  } catch (e) {
    console.warn(`[cache] set failed for ${key}:`, e);
  }
}

export async function getTimestamps(): Promise<CacheTimestamps> {
  return (await cacheGet<CacheTimestamps>("cache:timestamps")) ?? {};
}

export async function setTimestamp(
  source: "figma" | "asana"
): Promise<void> {
  const current = await getTimestamps();
  await cacheSet("cache:timestamps", {
    ...current,
    [source]: new Date().toISOString(),
  });
}

/** Build a deterministic cache key for a Figma date range */
export function figmaCacheKey(startTime: number, endTime: number): CacheKey {
  return `figma:team-activity:${startTime}:${endTime}`;
}

/** Build a cache key for Asana tasks (keyed by modified_since date or "all") */
export function asanaCacheKey(modifiedSince?: string): CacheKey {
  return `asana:tasks:${modifiedSince ?? "all"}`;
}

/** Build a cache key for completed Asana tasks */
export function completedCacheKey(date: string): CacheKey {
  return `asana:completed:${date}`;
}

/** Build a cache key for a weekly snapshot */
export function snapshotCacheKey(monday: string): CacheKey {
  return `snapshot:week:${monday}`;
}

/** Get the last N Monday dates as YYYY-MM-DD strings (most recent first) */
export function getRecentMondays(count: number): string[] {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(monday.getDate() - diff);
  monday.setHours(0, 0, 0, 0);

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() - i * 7);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

/** Batch-get multiple cache keys at once (returns array in same order, null for misses) */
export async function cacheGetMany<T>(keys: CacheKey[]): Promise<(T | null)[]> {
  if (!isKVConfigured() || keys.length === 0) return keys.map(() => null);
  try {
    const results = await kv.mget<T[]>(...keys);
    return results;
  } catch (e) {
    console.warn(`[cache] mget failed:`, e);
    return keys.map(() => null);
  }
}
