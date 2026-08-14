import { describe, it, expect } from 'vitest';
import { triageAgent } from '../../src/mastra/agents/triage';

describe('Triage Agent', () => {
  it('should have the correct id', () => {
    expect(triageAgent.id).toBe('triage-agent');
  });

  it('should have the correct name', () => {
    expect(triageAgent.name).toBe('Triage Agent');
  });

  it('should have a description for supervisor routing', () => {
    const desc = triageAgent.getDescription();
    expect(desc).toBeTruthy();
    expect(desc).toContain('Classif');
  });
});
