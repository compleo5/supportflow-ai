import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock the embedding model to avoid needing OPENAI_API_KEY at import time
vi.mock('@mastra/core/llm', () => ({
  ModelRouterEmbeddingModel: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

describe('FAQ Agent', () => {
  let faqAgent: any;

  beforeAll(async () => {
    const mod = await import('../../src/mastra/agents/faq');
    faqAgent = mod.faqAgent;
  });

  it('should have the correct id', () => {
    expect(faqAgent.id).toBe('faq-agent');
  });

  it('should have the correct name', () => {
    expect(faqAgent.name).toBe('FAQ & Product Agent');
  });

  it('should have a description for routing', () => {
    const desc = faqAgent.getDescription();
    expect(desc).toBeTruthy();
  });
});
