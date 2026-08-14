/**
 * SupportFlow AI — Shared Agent Processors
 *
 * Applied across agents at different pipeline stages:
 *
 *   INPUT (before LLM sees the message):
 *     - PromptInjectionDetector  — blocks jailbreaks and prompt injection attacks
 *     - ModerationProcessor      — blocks harassment, abuse, hate speech
 *
 *   OUTPUT (after LLM responds, before returning to caller):
 *     - PIIDetector              — redacts emails, phones, credit cards, SSNs from responses
 *     - RegexFilterProcessor     — zero-cost regex redaction of secrets/API keys in output
 *     - TokenLimiterProcessor    — caps response composer output at 800 tokens
 */

import {
  PromptInjectionDetector,
  ModerationProcessor,
  PIIDetector,
  RegexFilterProcessor,
  TokenLimiterProcessor,
} from '@mastra/core/processors';

// ---------------------------------------------------------------------------
// INPUT — Prompt Injection (all customer-facing agents)
// Blocks jailbreaks and attempts to override agent instructions.
// Uses Haiku for speed and cost efficiency.
// ---------------------------------------------------------------------------

export const promptInjectionDetector = new PromptInjectionDetector({
  model: 'anthropic/claude-haiku-4-5',
  strategy: 'block',
  threshold: 0.7,
});

// ---------------------------------------------------------------------------
// INPUT — Moderation (triage agent only — first touch on every email)
// Blocks harassment, threats, and abusive content before any LLM processing.
// ---------------------------------------------------------------------------

export const moderationProcessor = new ModerationProcessor({
  model: 'anthropic/claude-haiku-4-5',
  strategy: 'block',
  threshold: 0.7,
  categories: ['harassment', 'hate', 'threats', 'abuse'],
});

// ---------------------------------------------------------------------------
// OUTPUT — PII Redaction (response composer — customer-facing output)
// Redacts PII that may have leaked into the drafted email reply.
// LLM-based for accuracy on names, addresses, dates of birth.
// ---------------------------------------------------------------------------

export const piiOutputRedactor = new PIIDetector({
  model: 'anthropic/claude-haiku-4-5',
  strategy: 'redact',
  threshold: 0.6,
  detectionTypes: ['email', 'phone', 'credit-card', 'ssn', 'api-key', 'ip-address'],
});

// ---------------------------------------------------------------------------
// OUTPUT — Regex Secret Filter (all agents)
// Zero-cost regex pass that catches API keys and tokens in any output.
// Runs in addition to PII detector as a cheap safety net.
// ---------------------------------------------------------------------------

export const secretsOutputFilter = new RegexFilterProcessor({
  presets: ['secrets'],
  strategy: 'redact',
  phase: 'output',
});

// ---------------------------------------------------------------------------
// OUTPUT — Token Limiter (response composer only)
// Caps outgoing email drafts at 800 tokens — keeps replies concise.
// ---------------------------------------------------------------------------

export const emailTokenLimiter = new TokenLimiterProcessor({
  limit: 800,
  strategy: 'truncate',
});
