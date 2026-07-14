/**
 * Development-only in-memory idempotency cache.
 *
 * Production duplicate protection must live in the main application's MongoDB
 * (or a persistent store). This cache only prevents accidental immediate
 * replays while developing against mock mode.
 */
import type { BridgeEnvelope } from './response.js';

interface CacheEntry {
  envelope: BridgeEnvelope;
  expiresAt: number;
}

const TTL_MS = 10 * 60 * 1000;
const store = new Map<string, CacheEntry>();

function cacheKey(action: string, idempotencyKey: string): string {
  return `${action}:${idempotencyKey}`;
}

export function getCachedResponse(
  action: string,
  idempotencyKey: string,
): BridgeEnvelope | undefined {
  const entry = store.get(cacheKey(action, idempotencyKey));
  if (!entry) {
    return undefined;
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(cacheKey(action, idempotencyKey));
    return undefined;
  }
  return entry.envelope;
}

export function setCachedResponse(
  action: string,
  idempotencyKey: string,
  envelope: BridgeEnvelope,
): void {
  store.set(cacheKey(action, idempotencyKey), {
    envelope,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function __clearIdempotencyCache(): void {
  store.clear();
}
