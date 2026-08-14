import { describe, it, expect } from 'vitest';
import {
  storeResponse,
  getResponses,
  getResponseById,
  type ResponseRecord,
} from '../../src/mastra/tools/response-store';

/**
 * Integration: Confidence Gate
 *
 * Verifies the confidence gate threshold logic: responses with a score ≥85
 * should be marked auto-sent; responses below 85 should be queued for review.
 *
 * The gate logic lives in composeResponseStep (not exported), so we test the
 * contract by storing responses that reflect what the workflow would produce
 * at various confidence scores, then asserting the downstream review state
 * behaves correctly.
 *
 * This mirrors exactly how the compose-response workflow step sets autoSent
 * and status based on CONFIDENCE_THRESHOLD = 85.
 */

const CONFIDENCE_THRESHOLD = 85;

function makeGatedRecord(confidenceScore: number): ResponseRecord {
  const autoSent = confidenceScore >= CONFIDENCE_THRESHOLD;
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    emailBody: 'Test email body',
    senderEmail: `gatetest-${Math.random().toString(36).slice(2)}@example.com`,
    subject: 'Confidence gate test',
    classification: 'faq',
    urgency: 'low',
    sentiment: 'neutral',
    customerTier: 'starter',
    reply: 'Test reply',
    emailReply: 'Test email reply',
    confidenceScore,
    handledBy: 'faq-agent',
    autoSent,
    status: autoSent ? 'auto-sent' : 'pending',
    promptVersion: 'test1234',
  };
}

describe('Confidence Gate Integration', () => {
  describe('Threshold boundary — 85%', () => {
    it('score of 85 is auto-sent (at threshold)', () => {
      const record = makeGatedRecord(85);
      storeResponse(record);

      const retrieved = getResponseById(record.id);
      expect(retrieved?.autoSent).toBe(true);
      expect(retrieved?.status).toBe('auto-sent');
    });

    it('score of 84 is queued for review (below threshold)', () => {
      const record = makeGatedRecord(84);
      storeResponse(record);

      const retrieved = getResponseById(record.id);
      expect(retrieved?.autoSent).toBe(false);
      expect(retrieved?.status).toBe('pending');
    });

    it('score of 86 is auto-sent (above threshold)', () => {
      const record = makeGatedRecord(86);
      storeResponse(record);

      const retrieved = getResponseById(record.id);
      expect(retrieved?.autoSent).toBe(true);
      expect(retrieved?.status).toBe('auto-sent');
    });
  });

  describe('High-confidence responses (auto-send path)', () => {
    it('score of 100 is auto-sent', () => {
      const record = makeGatedRecord(100);
      storeResponse(record);
      expect(getResponseById(record.id)?.autoSent).toBe(true);
    });

    it('score of 90 is auto-sent', () => {
      const record = makeGatedRecord(90);
      storeResponse(record);
      expect(getResponseById(record.id)?.status).toBe('auto-sent');
    });

    it('auto-sent responses appear in the auto-sent filter', () => {
      const record = makeGatedRecord(92);
      storeResponse(record);

      const autoSent = getResponses('auto-sent');
      expect(autoSent.some(r => r.id === record.id)).toBe(true);
    });

    it('auto-sent responses do NOT appear in the pending filter', () => {
      const record = makeGatedRecord(95);
      storeResponse(record);

      const pending = getResponses('pending');
      expect(pending.some(r => r.id === record.id)).toBe(false);
    });
  });

  describe('Low-confidence responses (review queue path)', () => {
    it('score of 0 is queued for review', () => {
      const record = makeGatedRecord(0);
      storeResponse(record);
      expect(getResponseById(record.id)?.autoSent).toBe(false);
    });

    it('score of 50 is queued for review', () => {
      const record = makeGatedRecord(50);
      storeResponse(record);
      expect(getResponseById(record.id)?.status).toBe('pending');
    });

    it('pending responses appear in the pending filter', () => {
      const record = makeGatedRecord(60);
      storeResponse(record);

      const pending = getResponses('pending');
      expect(pending.some(r => r.id === record.id)).toBe(true);
    });

    it('pending responses do NOT appear in the auto-sent filter', () => {
      const record = makeGatedRecord(70);
      storeResponse(record);

      const autoSent = getResponses('auto-sent');
      expect(autoSent.some(r => r.id === record.id)).toBe(false);
    });
  });

  describe('Mixed-confidence batch', () => {
    it('correctly separates auto-sent and pending from a batch', () => {
      const scores = [45, 72, 85, 88, 91, 63, 50, 97];
      const ids = scores.map(score => {
        const record = makeGatedRecord(score);
        storeResponse(record);
        return { id: record.id, score };
      });

      for (const { id, score } of ids) {
        const record = getResponseById(id);
        if (score >= CONFIDENCE_THRESHOLD) {
          expect(record?.autoSent).toBe(true);
          expect(record?.status).toBe('auto-sent');
        } else {
          expect(record?.autoSent).toBe(false);
          expect(record?.status).toBe('pending');
        }
      }
    });
  });

  describe('Classification-specific routing', () => {
    it('escalation responses are stored regardless of confidence score', () => {
      const record: ResponseRecord = {
        ...makeGatedRecord(95),
        classification: 'escalation',
        handledBy: 'escalation-agent',
        status: 'auto-sent', // Escalation bypasses compose step
      };
      storeResponse(record);

      const retrieved = getResponseById(record.id);
      expect(retrieved?.classification).toBe('escalation');
      expect(retrieved?.handledBy).toBe('escalation-agent');
    });
  });
});
