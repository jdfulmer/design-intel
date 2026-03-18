// lib/cache.ts — Vercel KV cache layer (1hr TTL)
// Falls back gracefully if KV is not configured (e.g. local dev without KV)

import { kv } from "@vercel/kv";

const TTL_SECONDS = 60 * 60; // 1 hour

export type CacheKey =
  | `figma:team-activity:${string}`  // figma:team-activity:1234567890:1234567890
  | `asana:tasks:${string}`          // asana:tasks:all or asana:tasks:2026-03-04
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
  try {
    await kv.set(key, value, { ex: TTL_SECONDS });
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
