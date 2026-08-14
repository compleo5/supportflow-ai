/**
 * SupportFlow AI — Eval Dataset
 *
 * 20 test emails covering all 4 classification categories.
 * Used by the Mastra experiment runner (runExperiment) in triage-eval.test.ts.
 *
 * Each item follows the Mastra DataItem shape:
 *   - input:       prompt string sent to the triage agent
 *   - groundTruth: expected classification, urgency, and sentiment labels
 *
 * Run: npm run test:eval
 */

import type { DataItem } from '@mastra/core/datasets';

export interface TriageGroundTruth {
  classification: 'faq' | 'billing' | 'technical' | 'escalation';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  sentiment: 'positive' | 'neutral' | 'frustrated' | 'angry';
}

function makePrompt(subject: string, senderEmail: string, body: string): string {
  return `Classify this customer support email:\n\nSubject: ${subject}\nFrom: ${senderEmail}\n\n${body}`;
}

export const triageDataset: DataItem<string, TriageGroundTruth>[] = [
  // ── FAQ ─────────────────────────────────────────────────────────────────
  {
    id: 'faq-01',
    input: makePrompt('Password reset', 'customer@example.com', 'How do I reset my password? I forgot it.'),
    groundTruth: { classification: 'faq', urgency: 'low', sentiment: 'neutral' },
  },
  {
    id: 'faq-02',
    input: makePrompt('Pricing question', 'customer@example.com', 'What plans do you offer? I want to know the pricing.'),
    groundTruth: { classification: 'faq', urgency: 'low', sentiment: 'neutral' },
  },
  {
    id: 'faq-03',
    input: makePrompt('Data export', 'customer@example.com', 'Can I export my data to CSV? I need to run some reports.'),
    groundTruth: { classification: 'faq', urgency: 'low', sentiment: 'neutral' },
  },
  {
    id: 'faq-04',
    input: makePrompt('2FA setup', 'customer@example.com', 'How do I set up two-factor authentication? I want to secure my account.'),
    groundTruth: { classification: 'faq', urgency: 'low', sentiment: 'neutral' },
  },
  {
    id: 'faq-05',
    input: makePrompt('Data residency question', 'compliance@example.com', 'Where is my data stored? Is it in the EU? We need to comply with GDPR.'),
    groundTruth: { classification: 'faq', urgency: 'medium', sentiment: 'neutral' },
  },

  // ── Billing ──────────────────────────────────────────────────────────────
  {
    id: 'billing-01',
    input: makePrompt('Refund request', 'customer@example.com', 'I want a refund for my last payment. I was charged $79 but I only used the service for 3 days.'),
    groundTruth: { classification: 'billing', urgency: 'medium', sentiment: 'frustrated' },
  },
  {
    id: 'billing-02',
    input: makePrompt('Plan upgrade', 'customer@example.com', 'How do I upgrade from Starter to Professional? And will I be charged immediately?'),
    groundTruth: { classification: 'billing', urgency: 'low', sentiment: 'neutral' },
  },
  {
    id: 'billing-03',
    input: makePrompt('Double charge', 'customer@example.com', 'My credit card was charged twice this month. Please fix this immediately.'),
    groundTruth: { classification: 'billing', urgency: 'high', sentiment: 'frustrated' },
  },
  {
    id: 'billing-04',
    input: makePrompt('Invoice request', 'finance@example.com', 'I need a copy of my invoice from June for my expense report.'),
    groundTruth: { classification: 'billing', urgency: 'low', sentiment: 'neutral' },
  },
  {
    id: 'billing-05',
    input: makePrompt('Charged after cancellation', 'customer@example.com', 'I cancelled my subscription last week but I was still charged today. What is going on?'),
    groundTruth: { classification: 'billing', urgency: 'high', sentiment: 'frustrated' },
  },

  // ── Technical ────────────────────────────────────────────────────────────
  {
    id: 'tech-01',
    input: makePrompt('Slow dashboard', 'customer@example.com', 'The dashboard is loading very slowly. It takes over 30 seconds to load. I have fast internet.'),
    groundTruth: { classification: 'technical', urgency: 'medium', sentiment: 'frustrated' },
  },
  {
    id: 'tech-02',
    input: makePrompt('Slack integration broken', 'customer@example.com', 'Slack notifications stopped working 2 days ago. The integration page says it is connected.'),
    groundTruth: { classification: 'technical', urgency: 'medium', sentiment: 'neutral' },
  },
  {
    id: 'tech-03',
    input: makePrompt('Cannot login', 'customer@example.com', 'I get an "Invalid credentials" error when I try to log in. I am sure my password is correct.'),
    groundTruth: { classification: 'technical', urgency: 'high', sentiment: 'frustrated' },
  },
  {
    id: 'tech-04',
    input: makePrompt('Upload error', 'customer@example.com', 'File uploads are failing. I get an error every time I try to upload a PDF. The file is only 5MB.'),
    groundTruth: { classification: 'technical', urgency: 'medium', sentiment: 'frustrated' },
  },
  {
    id: 'tech-05',
    input: makePrompt('App crash', 'customer@example.com', 'The mobile app crashes immediately when I open it on my iPhone. I have the latest version.'),
    groundTruth: { classification: 'technical', urgency: 'high', sentiment: 'frustrated' },
  },

  // ── Escalation ───────────────────────────────────────────────────────────
  {
    id: 'esc-01',
    input: makePrompt('URGENT - Need manager', 'angry@example.com', 'This is the THIRD time I am writing about this issue. Nobody is helping me. I want to speak to a manager.'),
    groundTruth: { classification: 'escalation', urgency: 'high', sentiment: 'angry' },
  },
  {
    id: 'esc-02',
    input: makePrompt('Legal threat', 'legal@example.com', 'If this is not resolved by Friday I will be contacting my lawyer. This is unacceptable.'),
    groundTruth: { classification: 'escalation', urgency: 'critical', sentiment: 'angry' },
  },
  {
    id: 'esc-03',
    input: makePrompt('Contract cancellation', 'enterprise@example.com', 'I am cancelling my enterprise contract. Your service has been unreliable for months. Please process the cancellation immediately.'),
    groundTruth: { classification: 'escalation', urgency: 'high', sentiment: 'angry' },
  },
  {
    id: 'esc-04',
    input: makePrompt('Security breach', 'security@example.com', 'I believe someone has accessed my account without my permission. I see logins from IP addresses I do not recognize. This is a security breach.'),
    groundTruth: { classification: 'escalation', urgency: 'critical', sentiment: 'frustrated' },
  },
  {
    id: 'esc-05',
    input: makePrompt('Data loss incident', 'cto@example.com', 'Your product has caused us to lose important client data. We need an immediate call with your CTO to discuss remediation.'),
    groundTruth: { classification: 'escalation', urgency: 'critical', sentiment: 'angry' },
  },
];
