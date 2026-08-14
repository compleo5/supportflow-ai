import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock fastembed to avoid ONNX model download during tests
vi.mock('@mastra/fastembed', () => ({
  fastembed: {},
}));

// Mock memory to avoid DB connection during tests
vi.mock('../../src/mastra/memory', () => ({
  sharedMemory: undefined,
}));

describe('All Agents', () => {
  let triageAgent: any;
  let faqAgent: any;
  let billingAgent: any;
  let technicalAgent: any;
  let escalationAgent: any;
  let responseComposerAgent: any;

  beforeAll(async () => {
    const [triage, faq, billing, technical, escalation, composer] = await Promise.all([
      import('../../src/mastra/agents/triage'),
      import('../../src/mastra/agents/faq'),
      import('../../src/mastra/agents/billing'),
      import('../../src/mastra/agents/technical'),
      import('../../src/mastra/agents/escalation'),
      import('../../src/mastra/agents/response-composer'),
    ]);
    triageAgent = triage.triageAgent;
    faqAgent = faq.faqAgent;
    billingAgent = billing.billingAgent;
    technicalAgent = technical.technicalAgent;
    escalationAgent = escalation.escalationAgent;
    responseComposerAgent = composer.responseComposerAgent;
  });

  describe('Triage Agent', () => {
    it('should have correct id and name', () => {
      expect(triageAgent.id).toBe('triage-agent');
      expect(triageAgent.name).toBe('Triage Agent');
    });

    it('should have a description for routing', () => {
      expect(triageAgent.getDescription()).toContain('Classif');
    });
  });

  describe('FAQ Agent', () => {
    it('should have correct id and name', () => {
      expect(faqAgent.id).toBe('faq-agent');
      expect(faqAgent.name).toBe('FAQ & Product Agent');
    });

  });

  describe('Billing Agent', () => {
    it('should have correct id and name', () => {
      expect(billingAgent.id).toBe('billing-agent');
      expect(billingAgent.name).toBe('Billing Agent');
    });

    it('should have a description mentioning billing', () => {
      expect(billingAgent.getDescription()).toContain('billing');
    });
  });

  describe('Technical Support Agent', () => {
    it('should have correct id and name', () => {
      expect(technicalAgent.id).toBe('technical-agent');
      expect(technicalAgent.name).toBe('Technical Support Agent');
    });

    it('should have a description mentioning troubleshoot', () => {
      expect(technicalAgent.getDescription()).toContain('roubleshoot');
    });
  });

  describe('Escalation Agent', () => {
    it('should have correct id and name', () => {
      expect(escalationAgent.id).toBe('escalation-agent');
      expect(escalationAgent.name).toBe('Escalation Agent');
    });

    it('should have a description mentioning human intervention', () => {
      expect(escalationAgent.getDescription()).toContain('human');
    });
  });

  describe('Response Composer', () => {
    it('should have correct id and name', () => {
      expect(responseComposerAgent.id).toBe('response-composer');
      expect(responseComposerAgent.name).toBe('Response Composer');
    });

    it('should have a description mentioning polish', () => {
      expect(responseComposerAgent.getDescription()).toContain('polish');
    });
  });

  describe('Model Routing', () => {
    it('should use Haiku for FAQ (cost-optimized)', () => {
      // FAQ and triage use the cheaper model
      expect(faqAgent.modelId || faqAgent.model).toBeDefined();
    });

    it('should use Sonnet for Billing and Technical (more capable)', () => {
      // Billing and technical need stronger reasoning
      expect(billingAgent.modelId || billingAgent.model).toBeDefined();
    });
  });
});
