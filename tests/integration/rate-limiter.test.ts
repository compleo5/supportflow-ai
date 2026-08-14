import { describe, it, expect } from 'vitest';
import { checkRateLimit, getRateLimitStats } from '../../src/mastra/tools/rate-limiter';

/**
 * Integration: Rate Limiter
 *
 * Tests per-customer rate limiting across a full request window.
 * Uses unique email addresses per test to avoid state pollution
 * (the rate limiter uses module-level in-memory state).
 */

function uniqueEmail(label: string): string {
  return `test-${label}-${Math.random().toString(36).slice(2)}@example.com`;
}

describe('Rate Limiter Integration', () => {
  describe('Normal request flow', () => {
    it('allows the first request and returns correct remaining count', () => {
      const email = uniqueEmail('first');
      const result = checkRateLimit(email);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // 10 max - 1 used
    });

    it('allows sequential requests up to the limit', () => {
      const email = uniqueEmail('sequential');

      for (let i = 0; i < 10; i++) {
        const result = checkRateLimit(email);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(9 - i);
      }
    });

    it('blocks the request after 10 are exhausted', () => {
      const email = uniqueEmail('exhaust');

      // Exhaust all 10 slots
      for (let i = 0; i < 10; i++) {
        checkRateLimit(email);
      }

      // 11th request should be blocked
      const blocked = checkRateLimit(email);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it('provides a positive resetInSeconds when blocked', () => {
      const email = uniqueEmail('reset-time');

      for (let i = 0; i < 10; i++) {
        checkRateLimit(email);
      }

      const blocked = checkRateLimit(email);
      expect(blocked.allowed).toBe(false);
      expect(blocked.resetInSeconds).toBeGreaterThan(0);
      expect(blocked.resetInSeconds).toBeLessThanOrEqual(3600); // Within 1 hour window
    });
  });

  describe('Customer isolation', () => {
    it('tracks separate limits per customer email', () => {
      const customer1 = uniqueEmail('customer1');
      const customer2 = uniqueEmail('customer2');

      // Exhaust customer1's limit
      for (let i = 0; i < 10; i++) {
        checkRateLimit(customer1);
      }

      // customer2 should still have full allowance
      const result = checkRateLimit(customer2);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('treats email addresses as case-insensitive', () => {
      const baseEmail = uniqueEmail('casetest');
      const upperEmail = baseEmail.toUpperCase();

      // Use 9 requests on the lowercase version
      for (let i = 0; i < 9; i++) {
        checkRateLimit(baseEmail);
      }

      // The uppercase version is the same customer — should show 0 remaining
      const result = checkRateLimit(upperEmail);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });
  });

  describe('Stats', () => {
    it('returns rate limit stats for all tracked customers', () => {
      const email = uniqueEmail('stats');
      checkRateLimit(email);
      checkRateLimit(email);

      const stats = getRateLimitStats();
      const customerStats = stats.find(s => s.email === email.toLowerCase());

      expect(customerStats).toBeDefined();
      expect(customerStats?.requestCount).toBe(2);
      expect(customerStats?.remaining).toBe(8);
    });

    it('stats remaining is never negative', () => {
      const email = uniqueEmail('overshoot');

      for (let i = 0; i < 12; i++) {
        checkRateLimit(email);
      }

      const stats = getRateLimitStats();
      const customerStats = stats.find(s => s.email === email.toLowerCase());
      expect(customerStats?.remaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Boundary conditions', () => {
    it('10th request is allowed, 11th is blocked', () => {
      const email = uniqueEmail('boundary');

      for (let i = 0; i < 9; i++) {
        checkRateLimit(email);
      }

      const tenth = checkRateLimit(email);
      expect(tenth.allowed).toBe(true);
      expect(tenth.remaining).toBe(0);

      const eleventh = checkRateLimit(email);
      expect(eleventh.allowed).toBe(false);
    });

    it('returns resetInSeconds of 0 when no requests have been made', () => {
      const email = uniqueEmail('fresh');
      const result = checkRateLimit(email);
      // First request: no prior timestamps, resetInSeconds should be 0
      expect(result.resetInSeconds).toBe(0);
    });
  });
});
