import { describe, it, expect } from 'vitest';
import { supportPipeline } from '../../src/mastra/workflows/support-pipeline';

describe('Support Pipeline Workflow', () => {
  it('should have the correct id', () => {
    expect(supportPipeline.id).toBe('support-pipeline');
  });

  it('should have a description', () => {
    expect(supportPipeline.description).toBeTruthy();
  });
});
