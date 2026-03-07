import { Redis } from 'ioredis';

let _redis: Redis | undefined;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: (times) => (times < 3 ? Math.min(times * 100, 1000) : null),
    });
    _redis.on('error', (err: Error) => {
      console.error('[redis] connection error:', err.message);
    });
  }
  return _redis;
}

/** For test teardown only — reset the singleton so the next call reconnects. */
export function _resetRedis(): void {
  _redis = undefined;
}
