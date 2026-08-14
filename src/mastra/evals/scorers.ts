/**
 * SupportFlow AI — Mastra Scorers
 *
 * Scorer behaviour by context:
 *
 *   Live (Studio chat):
 *     - jsonFormatScorer        → always works, no groundTruth needed
 *     - answerRelevancyScorer   → LLM-as-judge, no groundTruth needed
 *     - classification/urgency/sentiment → skip (no groundTruth available live)
 *
 *   Experiment (npm run test:eval):
 *     - all 5 scorers run against the labelled dataset, scores persist to LibSQL
 */

import { createScorer } from '@mastra/core/evals';
import { getAssistantMessageFromRunOutput } from '@mastra/evals/scorers/utils';
import { createAnswerRelevancyScorer } from '@mastra/evals/scorers/prebuilt';

// ---------------------------------------------------------------------------
// Helper — extract JSON from agent output using Mastra's official utility
// ---------------------------------------------------------------------------

function parseAgentJSON(text: string): Record<string, string> | null {
  try {
    // Strip markdown code fences if present (e.g. ```json ... ```)
    const stripped = text.replace(/^```[a-z]*\n?/m, '').replace(/\n?```$/m, '').trim();
    const match = stripped.match(/\{[\s\S]*\}/);
    return JSON.parse(match?.[0] ?? stripped);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. JSON Format Scorer
// Works on live calls — no groundTruth needed.
// Score: (valid fields present) / 3 with partial credit.
// ---------------------------------------------------------------------------

export const jsonFormatScorer = createScorer({
  id: 'json-format',
  name: 'JSON Format',
  description:
    'Checks triage output is valid JSON containing classification, urgency, and sentiment fields. Score: number of required fields present divided by 3.',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const text = getAssistantMessageFromRunOutput(run.output) ?? '';
    const parsed = parseAgentJSON(text);
    return {
      rawText: text.slice(0, 200),
      isValid: parsed !== null,
      hasClassification: Boolean(parsed?.classification),
      hasUrgency: Boolean(parsed?.urgency),
      hasSentiment: Boolean(parsed?.sentiment),
    };
  })
  .generateScore(({ results }) => {
    const { isValid, hasClassification, hasUrgency, hasSentiment } =
      results.preprocessStepResult;
    if (!isValid) return 0;
    const present = [hasClassification, hasUrgency, hasSentiment].filter(Boolean).length;
    return parseFloat((present / 3).toFixed(2));
  })
  .generateReason(({ results }) => {
    const { isValid, hasClassification, hasUrgency, hasSentiment } =
      results.preprocessStepResult;
    if (!isValid) return 'Output is not valid JSON';
    const missing = [
      !hasClassification && 'classification',
      !hasUrgency && 'urgency',
      !hasSentiment && 'sentiment',
    ].filter(Boolean);
    if (missing.length === 0)
      return 'Valid JSON with all required fields: classification, urgency, sentiment';
    return `Valid JSON but missing required fields: ${missing.join(', ')}`;
  });

// ---------------------------------------------------------------------------
// 2. Classification Accuracy Scorer
// Meaningful only in experiments (requires groundTruth).
// ---------------------------------------------------------------------------

export const classificationAccuracyScorer = createScorer({
  id: 'classification-accuracy',
  name: 'Classification Accuracy',
  description:
    'Checks if the triage agent classified the email into the correct category. Requires groundTruth.classification. Score: 1 = correct, 0 = wrong.',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const text = getAssistantMessageFromRunOutput(run.output) ?? '';
    const parsed = parseAgentJSON(text);
    const groundTruth = run.groundTruth as { classification?: string } | undefined;
    return {
      actual: parsed?.classification ?? null,
      expected: groundTruth?.classification ?? null,
    };
  })
  .generateScore(({ results }) => {
    const { actual, expected } = results.preprocessStepResult;
    if (actual === null || expected === null) return 0;
    return actual === expected ? 1 : 0;
  })
  .generateReason(({ results }) => {
    const { actual, expected } = results.preprocessStepResult;
    if (expected === null) return 'No ground truth provided';
    if (actual === null) return 'Agent did not return a classification field';
    if (actual === expected) return `Correct — classified as "${actual}"`;
    return `Wrong — expected "${expected}", got "${actual}"`;
  });

// ---------------------------------------------------------------------------
// 3. Urgency Accuracy Scorer (experiment-only, partial credit)
// ---------------------------------------------------------------------------

const URGENCY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

export const urgencyAccuracyScorer = createScorer({
  id: 'urgency-accuracy',
  name: 'Urgency Accuracy',
  description:
    'Partial-credit scorer for urgency detection. Urgency is an ordered scale (low < medium < high < critical), so being one step off scores 0.67, two steps 0.33, fully wrong 0. Requires groundTruth.urgency.',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const text = getAssistantMessageFromRunOutput(run.output) ?? '';
    const parsed = parseAgentJSON(text);
    const groundTruth = run.groundTruth as { urgency?: string } | undefined;
    return {
      actual: parsed?.urgency ?? null,
      expected: groundTruth?.urgency ?? null,
    };
  })
  .generateScore(({ results }) => {
    const { actual, expected } = results.preprocessStepResult;
    if (actual === null || expected === null) return 0;
    const ai = URGENCY_LEVELS.indexOf(actual as typeof URGENCY_LEVELS[number]);
    const ei = URGENCY_LEVELS.indexOf(expected as typeof URGENCY_LEVELS[number]);
    if (ai === -1 || ei === -1) return 0;
    const distance = Math.abs(ai - ei);
    return parseFloat((1 - distance / (URGENCY_LEVELS.length - 1)).toFixed(2));
  })
  .generateReason(({ results }) => {
    const { actual, expected } = results.preprocessStepResult;
    if (expected === null) return 'No ground truth provided';
    if (actual === null) return 'Agent did not return an urgency field';
    if (actual === expected) return `Correct — urgency is "${actual}"`;
    const ai = URGENCY_LEVELS.indexOf(actual as typeof URGENCY_LEVELS[number]);
    const ei = URGENCY_LEVELS.indexOf(expected as typeof URGENCY_LEVELS[number]);
    const distance = Math.abs(ai - ei);
    return `Off by ${distance} level${distance > 1 ? 's' : ''} — expected "${expected}", got "${actual}"`;
  });

// ---------------------------------------------------------------------------
// 4. Sentiment Accuracy Scorer (experiment-only)
// ---------------------------------------------------------------------------

export const sentimentAccuracyScorer = createScorer({
  id: 'sentiment-accuracy',
  name: 'Sentiment Accuracy',
  description:
    'Checks if the triage agent correctly read the customer sentiment. Requires groundTruth.sentiment. Score: 1 = correct, 0 = wrong.',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const text = getAssistantMessageFromRunOutput(run.output) ?? '';
    const parsed = parseAgentJSON(text);
    const groundTruth = run.groundTruth as { sentiment?: string } | undefined;
    return {
      actual: parsed?.sentiment ?? null,
      expected: groundTruth?.sentiment ?? null,
    };
  })
  .generateScore(({ results }) => {
    const { actual, expected } = results.preprocessStepResult;
    if (actual === null || expected === null) return 0;
    return actual === expected ? 1 : 0;
  })
  .generateReason(({ results }) => {
    const { actual, expected } = results.preprocessStepResult;
    if (expected === null) return 'No ground truth provided';
    if (actual === null) return 'Agent did not return a sentiment field';
    if (actual === expected) return `Correct — sentiment is "${actual}"`;
    return `Wrong — expected "${expected}", got "${actual}"`;
  });

// ---------------------------------------------------------------------------
// 5. Answer Relevancy Scorer (LLM-as-Judge)
// Works on live calls — checks if the composed email addresses the customer issue.
// Runs on 20% of response-composer calls to control cost.
// ---------------------------------------------------------------------------

export const answerRelevancyScorer = createAnswerRelevancyScorer({
  model: 'anthropic/claude-haiku-4-5' as any,
});
