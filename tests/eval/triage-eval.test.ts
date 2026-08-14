/**
 * SupportFlow AI — Triage Agent Eval Suite
 *
 * Uses Mastra's native runExperiment API to batch-test the triage agent
 * against 20 labelled emails. Scores persist to LibSQL and are visible
 * in Mastra Studio → Evals.
 *
 * Scorers applied:
 *   - json-format             (must always be 1.0)
 *   - classification-accuracy (target ≥ 0.80)
 *   - urgency-accuracy        (target ≥ 0.70)
 *   - sentiment-accuracy      (target ≥ 0.70)
 *
 * Run: npm run test:eval
 * Requires: ANTHROPIC_API_KEY set in environment
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { runExperiment } from '@mastra/core/datasets';
import type { ExperimentSummary, ScorerResult } from '@mastra/core/datasets';
import { mastra } from '../../src/mastra/index';
import { triageDataset } from './test-emails';
import {
  classificationAccuracyScorer,
  urgencyAccuracyScorer,
  sentimentAccuracyScorer,
  jsonFormatScorer,
} from '../../src/mastra/evals/scorers';

// ---------------------------------------------------------------------------
// Thresholds — adjust as KB grows and accuracy improves
// ---------------------------------------------------------------------------
const THRESHOLDS = {
  jsonFormat: 1.0,       // output must always be valid JSON
  classification: 0.80,  // ≥80% category accuracy
  urgency: 0.70,         // ≥70% urgency accuracy
  sentiment: 0.70,       // ≥70% sentiment accuracy
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function meanScore(results: ExperimentSummary['results'], scorerId: string): number {
  const scores = results
    .flatMap(r => r.scores)
    .filter((s): s is ScorerResult & { score: number } =>
      s.scorerId === scorerId && s.score !== null
    )
    .map(s => s.score);

  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function printScorerSummary(summary: ExperimentSummary): void {
  const scorerIds = [
    'json-format',
    'classification-accuracy',
    'urgency-accuracy',
    'sentiment-accuracy',
  ];

  console.log('\n─── Triage Agent Eval Results ───────────────────────────────');
  console.log(`Items: ${summary.succeededCount}/${summary.totalItems} succeeded`);
  console.log('');

  for (const scorerId of scorerIds) {
    const mean = meanScore(summary.results, scorerId);
    console.log(`  ${scorerId.padEnd(28)} avg: ${(mean * 100).toFixed(1)}%`);
  }

  // Per-item classification breakdown
  console.log('\n  Per-item classification:');
  for (const item of summary.results) {
    const cls = item.scores.find(s => s.scorerId === 'classification-accuracy');
    const correct = cls?.score === 1 ? '✓' : '✗';
    console.log(`    ${correct} ${(item.itemId ?? '').padEnd(12)}`);
  }
  console.log('─────────────────────────────────────────────────────────────\n');
}

// ---------------------------------------------------------------------------
// Experiment
// ---------------------------------------------------------------------------

let summary: ExperimentSummary;

describe('Triage Agent Eval (Mastra runExperiment)', () => {
  beforeAll(async () => {
    summary = await runExperiment(mastra, {
      name: 'Triage Agent Classification Eval',
      description: 'Accuracy of classification, urgency, and sentiment detection across 20 labelled emails',
      data: triageDataset,
      targetType: 'agent',
      targetId: 'triage-agent',
      scorers: [
        jsonFormatScorer,
        classificationAccuracyScorer,
        urgencyAccuracyScorer,
        sentimentAccuracyScorer,
      ],
      maxConcurrency: 3,   // avoid rate limits during batch
      itemTimeout: 30_000, // 30s per item
    });

    printScorerSummary(summary);
  }, 5 * 60_000); // 5 min timeout for full suite

  it('all items executed without error', () => {
    expect(summary.failedCount).toBe(0);
    expect(summary.succeededCount).toBe(summary.totalItems);
  });

  it(`json-format score = ${THRESHOLDS.jsonFormat * 100}% (output always valid JSON)`, () => {
    const mean = meanScore(summary.results, 'json-format');
    expect(mean).toBeGreaterThanOrEqual(THRESHOLDS.jsonFormat);
  });

  it(`classification-accuracy ≥ ${THRESHOLDS.classification * 100}%`, () => {
    const mean = meanScore(summary.results, 'classification-accuracy');
    console.log(`  classification-accuracy: ${(mean * 100).toFixed(1)}%`);
    expect(mean).toBeGreaterThanOrEqual(THRESHOLDS.classification);
  });

  it(`urgency-accuracy ≥ ${THRESHOLDS.urgency * 100}%`, () => {
    const mean = meanScore(summary.results, 'urgency-accuracy');
    console.log(`  urgency-accuracy: ${(mean * 100).toFixed(1)}%`);
    expect(mean).toBeGreaterThanOrEqual(THRESHOLDS.urgency);
  });

  it(`sentiment-accuracy ≥ ${THRESHOLDS.sentiment * 100}%`, () => {
    const mean = meanScore(summary.results, 'sentiment-accuracy');
    console.log(`  sentiment-accuracy: ${(mean * 100).toFixed(1)}%`);
    expect(mean).toBeGreaterThanOrEqual(THRESHOLDS.sentiment);
  });
});
