import { describe, it, expect } from 'vitest';
import {
  storeResponse,
  getResponses,
  getResponseById,
  updateResponse,
  getStats,
  getPromptVersion,
  type ResponseRecord,
} from '../../src/mastra/tools/response-store';

/**
 * Integration: Review Lifecycle
 *
 * Tests the complete human review workflow across multiple modules:
 * store → list → approve/edit/reject → verify state → stats
 *
 * These tests use unique IDs and emails to avoid cross-test state pollution
 * (the store is module-level in-memory state).
 */

function makeRecord(overrides: Partial<ResponseRecord> = {}): ResponseRecord {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    emailBody: 'How do I reset my password?',
    senderEmail: `user-${Math.random().toString(36).slice(2)}@example.com`,
    subject: 'Password reset',
    classification: 'faq',
    urgency: 'low',
    sentiment: 'neutral',
    customerTier: 'starter',
    reply: 'To reset your password, go to the login page and click "Forgot Password".',
    emailReply: 'Hi there,\n\nTo reset your password...',
    confidenceScore: 72,
    handledBy: 'faq-agent',
    autoSent: false,
    status: 'pending',
    promptVersion: 'abc12345',
    ...overrides,
  };
}

describe('Review Lifecycle Integration', () => {
  describe('Store and retrieve', () => {
    it('stores a response and retrieves it by ID', () => {
      const record = makeRecord();
      storeResponse(record);

      const retrieved = getResponseById(record.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(record.id);
      expect(retrieved?.emailBody).toBe(record.emailBody);
    });

    it('returns undefined for a non-existent ID', () => {
      expect(getResponseById('non-existent-id-xyz')).toBeUndefined();
    });

    it('lists stored responses including the new one', () => {
      const record = makeRecord();
      storeResponse(record);

      const all = getResponses();
      const found = all.find(r => r.id === record.id);
      expect(found).toBeDefined();
    });
  });

  describe('Status filtering', () => {
    it('filters responses by status', () => {
      const pendingId = crypto.randomUUID();
      const autoSentId = crypto.randomUUID();

      storeResponse(makeRecord({ id: pendingId, status: 'pending', autoSent: false, confidenceScore: 60 }));
      storeResponse(makeRecord({ id: autoSentId, status: 'auto-sent', autoSent: true, confidenceScore: 92 }));

      const pending = getResponses('pending');
      const autoSent = getResponses('auto-sent');

      expect(pending.some(r => r.id === pendingId)).toBe(true);
      expect(autoSent.some(r => r.id === autoSentId)).toBe(true);

      // Verify cross-filter isolation
      expect(pending.some(r => r.id === autoSentId)).toBe(false);
      expect(autoSent.some(r => r.id === pendingId)).toBe(false);
    });
  });

  describe('Approve action', () => {
    it('transitions a pending response to approved', () => {
      const record = makeRecord({ status: 'pending' });
      storeResponse(record);

      const updated = updateResponse(record.id, {
        status: 'approved',
        reviewedAt: new Date().toISOString(),
        feedback: 'Clear and accurate answer.',
      });

      expect(updated?.status).toBe('approved');
      expect(updated?.reviewedAt).toBeDefined();
      expect(updated?.feedback).toBe('Clear and accurate answer.');
    });

    it('verified approval is reflected in the store', () => {
      const record = makeRecord({ status: 'pending' });
      storeResponse(record);
      updateResponse(record.id, { status: 'approved', reviewedAt: new Date().toISOString() });

      const retrieved = getResponseById(record.id);
      expect(retrieved?.status).toBe('approved');
    });
  });

  describe('Edit action', () => {
    it('stores the edited reply alongside the original', () => {
      const original = 'Original draft response.';
      const correction = 'Improved response with more detail about the grace period.';
      const record = makeRecord({ reply: original, emailReply: original, status: 'pending' });
      storeResponse(record);

      const updated = updateResponse(record.id, {
        status: 'edited',
        reviewedAt: new Date().toISOString(),
        editedReply: correction,
        feedback: 'Added grace period information.',
      });

      expect(updated?.status).toBe('edited');
      expect(updated?.editedReply).toBe(correction);
      expect(updated?.emailReply).toBe(original); // Original preserved
      expect(updated?.feedback).toBe('Added grace period information.');
    });
  });

  describe('Reject action', () => {
    it('marks a response as rejected without editing reply', () => {
      const record = makeRecord({ status: 'pending' });
      storeResponse(record);

      const updated = updateResponse(record.id, {
        status: 'rejected',
        reviewedAt: new Date().toISOString(),
        feedback: 'Incorrect policy applied — escalation needed.',
      });

      expect(updated?.status).toBe('rejected');
      expect(updated?.editedReply).toBeUndefined();
      expect(updated?.feedback).toContain('escalation needed');
    });
  });

  describe('updateResponse edge cases', () => {
    it('returns undefined when updating a non-existent ID', () => {
      const result = updateResponse('does-not-exist', { status: 'approved' });
      expect(result).toBeUndefined();
    });

    it('preserves unmodified fields when updating', () => {
      const record = makeRecord({ classification: 'billing', urgency: 'high' });
      storeResponse(record);

      updateResponse(record.id, { status: 'approved' });
      const retrieved = getResponseById(record.id);

      expect(retrieved?.classification).toBe('billing');
      expect(retrieved?.urgency).toBe('high');
    });
  });

  describe('Stats', () => {
    it('stats reflect pending and auto-sent counts accurately', () => {
      // Create a batch with known statuses
      const batchId = crypto.randomUUID().slice(0, 8);
      const pendingRecord = makeRecord({
        id: `${batchId}-pending`,
        status: 'pending',
        confidenceScore: 60,
        senderEmail: `${batchId}@test.com`,
      });
      const autoSentRecord = makeRecord({
        id: `${batchId}-auto`,
        status: 'auto-sent',
        confidenceScore: 92,
        autoSent: true,
        senderEmail: `${batchId}2@test.com`,
      });

      storeResponse(pendingRecord);
      storeResponse(autoSentRecord);

      const stats = getStats();
      expect(stats.total).toBeGreaterThanOrEqual(2);
      expect(stats.pending).toBeGreaterThanOrEqual(1);
      expect(stats.autoSent).toBeGreaterThanOrEqual(1);
      expect(stats.avgConfidence).toBeGreaterThan(0);
    });

    it('auto-send rate is a percentage 0-100', () => {
      const stats = getStats();
      expect(stats.autoSendRate).toBeGreaterThanOrEqual(0);
      expect(stats.autoSendRate).toBeLessThanOrEqual(100);
    });
  });

  describe('Prompt versioning', () => {
    it('generates a deterministic 8-char hex hash', () => {
      const v1 = getPromptVersion('faq-agent', 'answer about pricing');
      const v2 = getPromptVersion('faq-agent', 'answer about pricing');
      expect(v1).toBe(v2);
      expect(v1).toHaveLength(8);
      expect(v1).toMatch(/^[0-9a-f]{8}$/);
    });

    it('produces different versions for different agents', () => {
      const faqVersion = getPromptVersion('faq-agent', 'same content');
      const billingVersion = getPromptVersion('billing-agent', 'same content');
      expect(faqVersion).not.toBe(billingVersion);
    });

    it('produces different versions for different content', () => {
      const v1 = getPromptVersion('faq-agent', 'first version content');
      const v2 = getPromptVersion('faq-agent', 'updated content after prompt change');
      expect(v1).not.toBe(v2);
    });
  });
});
