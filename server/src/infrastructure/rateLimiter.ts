import rateLimit, { Options as RateLimitOptions, RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore, type RedisReply, type SendCommandFn } from 'rate-limit-redis';
import { createClient } from 'redis';

export async function createRateLimiter(redisUrl?: string): Promise<RateLimitRequestHandler> {
  const options: Partial<RateLimitOptions> = {
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests' },
  };

  if (!redisUrl) {
    return rateLimit(options);
  }

  const client = createClient({ url: redisUrl });
  client.on('error', (err) => {
    console.error('Redis client error (rate limiter)', err);
  });

  try {
    await client.connect();
    const sendCommand: SendCommandFn = (...commandArgs) =>
      client.sendCommand<RedisReply>(commandArgs);
    const store = new RedisStore({ sendCommand });
    return rateLimit({ ...options, store });
  } catch (err) {
    console.warn('Redis unavailable for rate limiting; falling back to in-memory limiter', err);
    return rateLimit(options);
  }
}
