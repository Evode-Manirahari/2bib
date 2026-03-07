import { getRedis } from './redis';

export async function getCached(key: string): Promise<string | null> {
  try {
    return await getRedis().get(key);
  } catch {
    return null;
  }
}

export async function setCached(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    await getRedis().setex(key, ttlSeconds, value);
  } catch {
    // Swallow cache write errors — they are non-critical
  }
}

/** Delete all keys matching a glob pattern via SCAN + DEL. */
export async function invalidateByPattern(pattern: string): Promise<void> {
  try {
    const redis = getRedis();
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
      cursor = next;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch {
    // Swallow cache invalidation errors
  }
}
