import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResponseRecord } from '../../src/mastra/tools/response-store';

/**
 * Integration: Learning Loop
 *
 * Tests processReviewedResponse — the function that feeds reviewed responses
 * back into the knowledge base vector store.
 *
 * The vector store and embedding model are mocked to avoid needing a running
 * LibSQL instance or API key in CI.
 */

vi.mock('ai', () => ({
  embed: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }),
}));

vi.mock('@mastra/fastembed', () => ({
  fastembed: 'mock-fastembed-model',
}));

function makeRecord(overrides: Partial<ResponseRecord> = {}): ResponseRecord {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    emailBody: 'How do I export my data from the dashboard?',
    senderEmail: 'user@example.com',
    subject: 'Data export question',
    classification: 'faq',
    urgency: 'low',
    sentiment: 'neutral',
    customerTier: 'starter',
    reply: 'You can export data from Settings → Data → Export.',
    emailReply: 'Hi,\n\nYou can export your data from Settings → Data → Export as CSV or JSON.',
    confidenceScore: 88,
    handledBy: 'faq-agent',
    autoSent: false,
    status: 'pending',
    promptVersion: 'abc12345',
    ...overrides,
  };
}

function makeMockVectorStore() {
  return {
    upsert: vi.fn().mockResolvedValue(undefined),
  };
}

describe('Learning Loop Integration', () => {
  let mockVectorStore: ReturnType<typeof makeMockVectorStore>;

  beforeEach(() => {
    mockVectorStore = makeMockVectorStore();
    vi.clearAllMocks();
  });

  describe('Approved responses', () => {
    it('embeds an approved response into the knowledge base', async () => {
      const { processReviewedResponse } = await import('../../src/mastra/tools/learning-loop');
      const record = makeRecord({ status: 'approved' });

      const result = await processReviewedResponse(record, mockVectorStore as any);

      expect(result.action).toBe('added_verified');
      expect(result.chunksAdded).toBe(1);
      expect(mockVectorStore.upsert).toHaveBeenCalledTimes(1);
    });

    it('upserts with correct index name and metadata', async () => {
      const { processReviewedResponse } = await import('../../src/mastra/tools/learning-loop');
      const record = makeRecord({ status: 'approved', classification: 'billing' });

      await processReviewedResponse(record, mockVectorStore as any);

      const callArgs = mockVectorStore.upsert.mock.calls[0][0];
      expect(callArgs.indexName).toBe('support_kb');
      expect(callArgs.metadata[0].source).toBe('learning-loop');
      expect(callArgs.metadata[0].classification).toBe('billing');
      expect(callArgs.metadata[0].reviewStatus).toBe('approved');
      expect(callArgs.metadata[0].file).toContain(record.id);
    });

    it('includes the original email and approved answer in the embedded text', async () => {
      const { processReviewedResponse } = await import('../../src/mastra/tools/learning-loop');
      const record = makeRecord({ status: 'approved' });

      await processReviewedResponse(record, mockVectorStore as any);

      const callArgs = mockVectorStore.upsert.mock.calls[0][0];
      const embeddedText = callArgs.metadata[0].text;
      expect(embeddedText).toContain(record.emailBody);
      expect(embeddedText).toContain(record.emailReply);
    });

    it('includes reviewer feedback in the embedded text when provided', async () => {
      const { processReviewedResponse } = await import('../../src/mastra/tools/learning-loop');
      const record = makeRecord({
        status: 'approved',
        feedback: 'Excellent response, very clear instructions.',
      });

      await processReviewedResponse(record, mockVectorStore as any);

      const callArgs = mockVectorStore.upsert.mock.calls[0][0];
      expect(callArgs.metadata[0].text).toContain('Excellent response, very clear instructions.');
    });
  });

  describe('Edited responses', () => {
    it('uses the editedReply (not emailReply) when the status is edited', async () => {
      const { processReviewedResponse } = await import('../../src/mastra/tools/learning-loop');
      const correction = 'Corrected: Go to Settings → Export → choose CSV format. Note the 30-day data retention limit.';
      const record = makeRecord({
        status: 'edited',
        emailReply: 'Original draft that was incorrect.',
        editedReply: correction,
      });

      await processReviewedResponse(record, mockVectorStore as any);

      const callArgs = mockVectorStore.upsert.mock.calls[0][0];
      expect(callArgs.metadata[0].text).toContain(correction);
      expect(callArgs.metadata[0].text).not.toContain('Original draft that was incorrect.');
    });

    it('returns action "added_correction" for edited responses', async () => {
      const { processReviewedResponse } = await import('../../src/mastra/tools/learning-loop');
      const record = makeRecord({ status: 'edited', editedReply: 'Better answer.' });

      const result = await processReviewedResponse(record, mockVectorStore as any);

      expect(result.action).toBe('added_correction');
      expect(result.chunksAdded).toBe(1);
    });

    it('falls back to emailReply if editedReply is not set', async () => {
      const { processReviewedResponse } = await import('../../src/mastra/tools/learning-loop');
      const record = makeRecord({
        status: 'edited',
        editedReply: undefined,
      });

      await processReviewedResponse(record, mockVectorStore as any);

      const callArgs = mockVectorStore.upsert.mock.calls[0][0];
      expect(callArgs.metadata[0].text).toContain(record.emailReply);
    });
  });

  describe('Rejected responses', () => {
    it('does NOT embed rejected responses into the KB', async () => {
      const { processReviewedResponse } = await import('../../src/mastra/tools/learning-loop');
      const record = makeRecord({ status: 'rejected' });

      const result = await processReviewedResponse(record, mockVectorStore as any);

      expect(result.action).toBe('logged_rejection');
      expect(result.chunksAdded).toBe(0);
      expect(mockVectorStore.upsert).not.toHaveBeenCalled();
    });
  });

  describe('Skipped statuses', () => {
    it('skips pending responses and adds nothing to KB', async () => {
      const { processReviewedResponse } = await import('../../src/mastra/tools/learning-loop');
      const record = makeRecord({ status: 'pending' });

      const result = await processReviewedResponse(record, mockVectorStore as any);

      expect(result.action).toBe('skipped');
      expect(result.chunksAdded).toBe(0);
      expect(mockVectorStore.upsert).not.toHaveBeenCalled();
    });

    it('skips auto-sent responses', async () => {
      const { processReviewedResponse } = await import('../../src/mastra/tools/learning-loop');
      const record = makeRecord({ status: 'auto-sent', autoSent: true });

      const result = await processReviewedResponse(record, mockVectorStore as any);

      expect(result.action).toBe('skipped');
      expect(result.chunksAdded).toBe(0);
      expect(mockVectorStore.upsert).not.toHaveBeenCalled();
    });
  });
});
