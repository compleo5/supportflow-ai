/**
 * Per-customer rate limiter.
 *
 * Prevents a single customer from overwhelming the system
 * by limiting to MAX_REQUESTS_PER_HOUR per email address.
 */

const MAX_REQUESTS_PER_HOUR = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

const requestLog: Map<string, number[]> = new Map();

/**
 * Check if a customer has exceeded the rate limit.
 * Returns { allowed, remaining, resetIn } where resetIn is seconds until the oldest request expires.
 */
export function checkRateLimit(customerEmail: string): {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
} {
  const now = Date.now();
  const key = customerEmail.toLowerCase();

  // Get or create request log for this customer
  let timestamps = requestLog.get(key) || [];

  // Remove expired timestamps
  timestamps = timestamps.filter(t => now - t < WINDOW_MS);
  requestLog.set(key, timestamps);

  const remaining = Math.max(0, MAX_REQUESTS_PER_HOUR - timestamps.length);
  const resetInSeconds =
    timestamps.length > 0 ? Math.ceil((timestamps[0] + WINDOW_MS - now) / 1000) : 0;

  if (timestamps.length >= MAX_REQUESTS_PER_HOUR) {
    return { allowed: false, remaining: 0, resetInSeconds };
  }

  // Record this request
  timestamps.push(now);
  return { allowed: true, remaining: remaining - 1, resetInSeconds };
}

/**
 * Get rate limit stats for all tracked customers.
 */
export function getRateLimitStats(): Array<{
  email: string;
  requestCount: number;
  remaining: number;
}> {
  const now = Date.now();
  const stats: Array<{ email: string; requestCount: number; remaining: number }> = [];

  for (const [email, timestamps] of requestLog) {
    const active = timestamps.filter(t => now - t < WINDOW_MS);
    stats.push({
      email,
      requestCount: active.length,
      remaining: Math.max(0, MAX_REQUESTS_PER_HOUR - active.length),
    });
  }

  return stats;
}
