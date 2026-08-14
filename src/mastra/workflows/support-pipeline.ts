import { createWorkflow, createStep } from '@mastra/core/workflows';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { storeResponse, getPromptVersion } from '../tools/response-store';
import { checkRateLimit } from '../tools/rate-limiter';

const CONFIDENCE_THRESHOLD = 85;

// Shared schemas
const emailInputSchema = z.object({
  emailBody: z.string(),
  senderEmail: z.string().optional(),
  subject: z.string().optional(),
});

const triageOutputSchema = z.object({
  emailBody: z.string(),
  senderEmail: z.string().optional(),
  subject: z.string().optional(),
  classification: z.enum(['faq', 'billing', 'technical', 'escalation']),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
  sentiment: z.enum(['positive', 'neutral', 'frustrated', 'angry']),
  summary: z.string(),
  intents: z.array(z.string()),
  customerTier: z.string(),
  previousTickets: z.number(),
});

const specialistOutputSchema = z.object({
  reply: z.string(),
  confidenceScore: z.number(),
  classification: z.string(),
  handledBy: z.string(),
});

const finalOutputSchema = z.object({
  id: z.string(),
  emailReply: z.string(),
  confidenceScore: z.number(),
  classification: z.string(),
  handledBy: z.string(),
  customerTier: z.string(),
  urgency: z.string(),
  sentiment: z.string(),
  autoSent: z.boolean(),
  status: z.string(),
  promptVersion: z.string(),
});

/**
 * Step 0: Pre-filter — detect non-support emails (spam, sales, recruiting).
 */
const preFilterStep = createStep({
  id: 'pre-filter',
  inputSchema: emailInputSchema,
  outputSchema: emailInputSchema,
  execute: async ({ inputData }) => {
    // Rate limiting
    if (inputData.senderEmail) {
      const rateCheck = checkRateLimit(inputData.senderEmail);
      if (!rateCheck.allowed) {
        throw new Error(
          `Rate limited: ${inputData.senderEmail} has exceeded ${10} requests/hour. Reset in ${rateCheck.resetInSeconds}s.`,
        );
      }
    }

    const body = (inputData.emailBody || '').toLowerCase();
    const subject = (inputData.subject || '').toLowerCase();
    const combined = `${subject} ${body}`;

    // Simple keyword-based spam/non-support detection
    const spamSignals = [
      'unsubscribe from this list',
      'click here to claim',
      'you have been selected',
      'nigerian prince',
      'lottery winner',
    ];
    const salesSignals = [
      'schedule a demo',
      'partnership opportunity',
      'we noticed your company',
      'would love to connect',
      'exclusive offer for',
    ];
    const recruitingSignals = [
      'job opportunity',
      'we are hiring',
      'open position',
      'career opportunity',
      'your resume',
    ];

    const isSpam = spamSignals.some(s => combined.includes(s));
    const isSales = salesSignals.some(s => combined.includes(s));
    const isRecruiting = recruitingSignals.some(s => combined.includes(s));

    if (isSpam || isSales || isRecruiting) {
      const reason = isSpam ? 'spam' : isSales ? 'sales' : 'recruiting';
      // Store as auto-rejected and return a non-support response
      const id = randomUUID();
      storeResponse({
        id,
        createdAt: new Date().toISOString(),
        emailBody: inputData.emailBody,
        senderEmail: inputData.senderEmail,
        subject: inputData.subject,
        classification: reason,
        urgency: 'low',
        sentiment: 'neutral',
        customerTier: 'none',
        reply: `Filtered: ${reason}`,
        emailReply: `Filtered: ${reason}`,
        confidenceScore: 100,
        handledBy: 'pre-filter',
        autoSent: false,
        status: 'rejected',
        promptVersion: 'filter-v1',
      });
      throw new Error(`Non-support email filtered: ${reason}`);
    }

    return inputData;
  },
});

/**
 * Step 1: Triage — classify the email using the Triage Agent.
 */
const triageStep = createStep({
  id: 'triage',
  inputSchema: emailInputSchema,
  outputSchema: triageOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const triageAgent = mastra?.getAgent('triage-agent');
    if (!triageAgent) throw new Error('Triage agent not found');

    const prompt = `Classify this customer support email:

Subject: ${inputData.subject || '(no subject)'}
From: ${inputData.senderEmail || '(unknown)'}

${inputData.emailBody}`;

    const result = await triageAgent.generate(prompt);

    let parsed;
    try {
      const text = result.text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] || text);
    } catch {
      parsed = {
        classification: 'faq',
        urgency: 'medium',
        sentiment: 'neutral',
        summary: 'Unable to classify — defaulting to FAQ',
        intents: ['general question'],
      };
    }

    return {
      emailBody: inputData.emailBody,
      senderEmail: inputData.senderEmail,
      subject: inputData.subject,
      classification: parsed.classification,
      urgency: parsed.urgency,
      sentiment: parsed.sentiment,
      summary: parsed.summary,
      intents: parsed.intents || [parsed.classification],
      // Simulated customer context (Phase 2 enrichment)
      customerTier: simulateCustomerTier(inputData.senderEmail),
      previousTickets: simulatePreviousTickets(inputData.senderEmail),
    };
  },
});

/**
 * Simulated customer context — in production this would query a CRM/database.
 */
function simulateCustomerTier(email?: string): string {
  if (!email) return 'starter';
  if (email.includes('enterprise') || email.includes('corp')) return 'enterprise';
  if (email.includes('pro') || email.includes('premium')) return 'professional';
  return 'starter';
}

function simulatePreviousTickets(email?: string): number {
  if (!email) return 0;
  // Deterministic pseudo-random based on email
  let hash = 0;
  for (const char of email) hash = (hash * 31 + char.charCodeAt(0)) % 100;
  return hash % 8; // 0-7 previous tickets
}

/**
 * Step 2a: FAQ handler
 */
const faqStep = createStep({
  id: 'faq-handler',
  inputSchema: triageOutputSchema,
  outputSchema: specialistOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const faqAgent = mastra?.getAgent('faq-agent');
    if (!faqAgent) throw new Error('FAQ agent not found');

    const prompt = `A customer has sent the following support email. Answer their question using the knowledge base.

Customer email:
${inputData.emailBody}

Customer's issue summary: ${inputData.summary}
Customer tier: ${inputData.customerTier}`;

    const result = await faqAgent.generate(prompt);
    const text = result.text;

    const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+)/);
    const confidenceScore = confidenceMatch ? parseInt(confidenceMatch[1], 10) : 50;
    const reply = text.replace(/\nCONFIDENCE:\s*\d+\s*$/, '').trim();

    return { reply, confidenceScore, classification: 'faq', handledBy: 'faq-agent' };
  },
});

/**
 * Step 2b: Billing handler
 */
const billingStep = createStep({
  id: 'billing-handler',
  inputSchema: triageOutputSchema,
  outputSchema: specialistOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const billingAgent = mastra?.getAgent('billing-agent');
    if (!billingAgent) throw new Error('Billing agent not found');

    const prompt = `A customer has a billing inquiry. Review the relevant policies and provide a resolution.

Customer email:
${inputData.emailBody}

Issue summary: ${inputData.summary}
Customer tier: ${inputData.customerTier}
Previous tickets: ${inputData.previousTickets}
Sentiment: ${inputData.sentiment}`;

    const result = await billingAgent.generate(prompt);
    const text = result.text;

    const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+)/);
    const confidenceScore = confidenceMatch ? parseInt(confidenceMatch[1], 10) : 50;
    const reply = text.replace(/\nCONFIDENCE:\s*\d+\s*$/, '').trim();

    return { reply, confidenceScore, classification: 'billing', handledBy: 'billing-agent' };
  },
});

/**
 * Step 2c: Technical handler
 */
const technicalStep = createStep({
  id: 'technical-handler',
  inputSchema: triageOutputSchema,
  outputSchema: specialistOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const technicalAgent = mastra?.getAgent('technical-agent');
    if (!technicalAgent) throw new Error('Technical agent not found');

    const prompt = `A customer is experiencing a technical issue. Diagnose and provide troubleshooting steps.

Customer email:
${inputData.emailBody}

Issue summary: ${inputData.summary}
Customer tier: ${inputData.customerTier}
Urgency: ${inputData.urgency}`;

    const result = await technicalAgent.generate(prompt);
    const text = result.text;

    const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+)/);
    const confidenceScore = confidenceMatch ? parseInt(confidenceMatch[1], 10) : 50;
    const reply = text.replace(/\nCONFIDENCE:\s*\d+\s*$/, '').trim();

    return { reply, confidenceScore, classification: 'technical', handledBy: 'technical-agent' };
  },
});

/**
 * Step 2d: Escalation handler
 */
const escalationStep = createStep({
  id: 'escalation-handler',
  inputSchema: triageOutputSchema,
  outputSchema: specialistOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const escalationAgent = mastra?.getAgent('escalation-agent');
    if (!escalationAgent) throw new Error('Escalation agent not found');

    const prompt = `Create an escalation handoff document for this customer issue.

Customer email:
${inputData.emailBody}

Customer: ${inputData.senderEmail || 'unknown'}
Issue summary: ${inputData.summary}
Urgency: ${inputData.urgency}
Sentiment: ${inputData.sentiment}
Customer tier: ${inputData.customerTier}
Previous tickets: ${inputData.previousTickets}`;

    const result = await escalationAgent.generate(prompt);
    const text = result.text;

    const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+)/);
    const confidenceScore = confidenceMatch ? parseInt(confidenceMatch[1], 10) : 95;
    const reply = text.replace(/\nCONFIDENCE:\s*\d+\s*$/, '').trim();

    return { reply, confidenceScore, classification: 'escalation', handledBy: 'escalation-agent' };
  },
});

/**
 * Step 3: Merge branch results.
 */
const mergeResultsStep = createStep({
  id: 'merge-results',
  inputSchema: z.object({
    'faq-handler': specialistOutputSchema.optional(),
    'billing-handler': specialistOutputSchema.optional(),
    'technical-handler': specialistOutputSchema.optional(),
    'escalation-handler': specialistOutputSchema.optional(),
  }),
  outputSchema: specialistOutputSchema,
  execute: async ({ inputData }) => {
    const result =
      inputData['faq-handler'] ||
      inputData['billing-handler'] ||
      inputData['technical-handler'] ||
      inputData['escalation-handler'];
    if (!result) throw new Error('No handler produced a result');
    return result;
  },
});

/**
 * Step 4: Response Composer — polish the specialist's draft into a customer-facing email.
 * Uses .map() to inject triage context alongside the specialist output.
 */
const composeResponseStep = createStep({
  id: 'compose-response',
  inputSchema: specialistOutputSchema,
  outputSchema: finalOutputSchema,
  stateSchema: z.object({
    emailBody: z.string().optional(),
    senderEmail: z.string().optional(),
    sentiment: z.string().optional(),
    classification: z.string().optional(),
    customerTier: z.string().optional(),
    urgency: z.string().optional(),
  }),
  execute: async ({ inputData, mastra, state }) => {
    let emailReply: string;
    let confidenceScore: number;

    // For escalations, skip composing — the handoff doc is the output
    if (inputData.classification === 'escalation') {
      emailReply = inputData.reply;
      confidenceScore = inputData.confidenceScore;
    } else {
      const composer = mastra?.getAgent('response-composer');
      if (!composer) throw new Error('Response composer not found');

      const prompt = `Polish this draft response into a customer-facing email.

ORIGINAL CUSTOMER EMAIL:
${state?.emailBody || '(not available)'}

CUSTOMER SENTIMENT: ${state?.sentiment || 'neutral'}
CUSTOMER TIER: ${state?.customerTier || 'starter'}

SPECIALIST DRAFT RESPONSE:
${inputData.reply}

Rewrite this as a polished email. End with CONFIDENCE: ${inputData.confidenceScore}`;

      const result = await composer.generate(prompt);
      const text = result.text;

      const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+)/);
      confidenceScore = confidenceMatch
        ? parseInt(confidenceMatch[1], 10)
        : inputData.confidenceScore;
      emailReply = text.replace(/\nCONFIDENCE:\s*\d+\s*$/, '').trim();
    }

    // Confidence gate: ≥85% → auto-send, <85% → queue for human review
    const autoSent = confidenceScore >= CONFIDENCE_THRESHOLD;
    const status = autoSent ? 'auto-sent' : 'pending';

    // Prompt versioning
    const promptVersion = getPromptVersion(inputData.handledBy, inputData.reply.slice(0, 100));

    // Store the response for the review UI
    const id = randomUUID();
    storeResponse({
      id,
      createdAt: new Date().toISOString(),
      emailBody: state?.emailBody || '',
      senderEmail: state?.senderEmail,
      subject: undefined,
      classification: inputData.classification,
      urgency: state?.urgency || 'medium',
      sentiment: state?.sentiment || 'neutral',
      customerTier: state?.customerTier || 'starter',
      reply: inputData.reply,
      emailReply,
      confidenceScore,
      handledBy: inputData.handledBy,
      autoSent,
      status,
      promptVersion,
    });

    return {
      id,
      emailReply,
      confidenceScore,
      classification: inputData.classification,
      handledBy: inputData.handledBy,
      customerTier: state?.customerTier || 'starter',
      urgency: state?.urgency || 'medium',
      sentiment: state?.sentiment || 'neutral',
      autoSent,
      status,
      promptVersion,
    };
  },
});

/**
 * Step 5: Post-processing — handle integrations (Zendesk, Slack, Email).
 */
const integrationsStep = createStep({
  id: 'integrations',
  inputSchema: finalOutputSchema,
  outputSchema: finalOutputSchema,
  stateSchema: z.object({
    emailBody: z.string().optional(),
    senderEmail: z.string().optional(),
    sentiment: z.string().optional(),
    classification: z.string().optional(),
    customerTier: z.string().optional(),
    urgency: z.string().optional(),
  }),
  execute: async ({ inputData, mastra, state }) => {
    const senderEmail = state?.senderEmail;
    const urgencyToZendeskPriority: Record<string, string> = {
      low: 'low',
      medium: 'normal',
      high: 'high',
      critical: 'urgent',
    };

    // 1. Zendesk — search for existing open ticket, then create or reply
    let ticketId: number | undefined;

    try {
      // Check if customer already has an open ticket
      if (senderEmail) {
        const searchTool = mastra?.getTool('search-zendesk-tickets');
        if (searchTool?.execute) {
          const searchResult = (await searchTool.execute(
            { requesterEmail: senderEmail } as any,
            { mastra } as any,
          )) as any;
          const openTicket = searchResult?.tickets?.find(
            (t: any) => t.status === 'new' || t.status === 'open' || t.status === 'pending',
          );
          if (openTicket) {
            ticketId = openTicket.id;
          }
        }
      }

      if (ticketId) {
        // Reply to existing ticket
        const updateTool = mastra?.getTool('update-zendesk-ticket');
        if (updateTool?.execute) {
          await updateTool.execute(
            {
              ticketId,
              comment: inputData.emailReply,
              priority: urgencyToZendeskPriority[inputData.urgency] || 'normal',
              tags: [inputData.classification, `confidence-${inputData.confidenceScore}`],
            } as any,
            { mastra } as any,
          );
          console.log(`[Integrations] Replied to Zendesk ticket #${ticketId}`);
        }
      } else {
        // Create new ticket
        const createTool = mastra?.getTool('create-zendesk-ticket');
        if (createTool?.execute) {
          const isEscalation = inputData.classification === 'escalation';
          const ticketResult = (await createTool.execute(
            {
              subject: isEscalation
                ? `[Escalation] ${inputData.urgency.toUpperCase()} — ${senderEmail || 'Unknown customer'}`
                : `Support: ${inputData.classification} — ${senderEmail || 'Unknown customer'}`,
              description: inputData.emailReply,
              requesterEmail: senderEmail,
              priority: urgencyToZendeskPriority[inputData.urgency] || 'normal',
              tags: [
                inputData.classification,
                `sentiment-${inputData.sentiment}`,
                `confidence-${inputData.confidenceScore}`,
                ...(isEscalation ? ['escalation'] : []),
              ],
            } as any,
            { mastra } as any,
          )) as any;
          ticketId = ticketResult?.ticketId;
          console.log(`[Integrations] Created Zendesk ticket #${ticketId}`);
        }
      }
    } catch (err) {
      console.error('[Integrations] Zendesk failed:', err);
    }

    // 2. Escalations → Slack alert
    if (inputData.classification === 'escalation') {
      try {
        const slackTool = mastra?.getTool('send-escalation-alert');
        if (slackTool?.execute) {
          await slackTool.execute(
            {
              customerEmail: senderEmail,
              summary: `${inputData.urgency.toUpperCase()} escalation from ${senderEmail || 'unknown'}`,
              urgency: inputData.urgency,
              ticketId,
              handoffDoc: inputData.emailReply,
            } as any,
            { mastra } as any,
          );
          console.log('[Integrations] Slack escalation alert sent');
        }
      } catch (err) {
        console.error('[Integrations] Slack alert failed:', err);
      }
    }

    // Email reply is handled by Zendesk (auto-reply on ticket create/update),
    // so we don't send separately to avoid double-sending.

    return inputData;
  },
});

/**
 * Support Pipeline Workflow
 *
 * Flow: Email → Pre-filter → Triage → Branch (FAQ | Billing | Technical | Escalation) → Merge → Compose → Integrations → Output
 */
export const supportPipeline = createWorkflow({
  id: 'support-pipeline',
  description:
    'Processes incoming customer support emails: classifies, enriches with customer context, routes to specialist agent, composes a polished response.',
  inputSchema: emailInputSchema,
  outputSchema: finalOutputSchema,
  stateSchema: z.object({
    emailBody: z.string().optional(),
    senderEmail: z.string().optional(),
    sentiment: z.string().optional(),
    classification: z.string().optional(),
    customerTier: z.string().optional(),
    urgency: z.string().optional(),
  }),
})
  .then(preFilterStep)
  .then(triageStep)
  .map(async ({ inputData, setState }) => {
    // Stash triage context into state for the composer step later
    setState?.({
      emailBody: inputData.emailBody,
      senderEmail: inputData.senderEmail,
      sentiment: inputData.sentiment,
      classification: inputData.classification,
      customerTier: inputData.customerTier,
      urgency: inputData.urgency,
    });
    return inputData;
  })
  .branch([
    [async ({ inputData }) => inputData.classification === 'faq', faqStep],
    [async ({ inputData }) => inputData.classification === 'billing', billingStep],
    [async ({ inputData }) => inputData.classification === 'technical', technicalStep],
    [async () => true, escalationStep], // catch-all → escalation
  ])
  .then(mergeResultsStep)
  .then(composeResponseStep)
  .then(integrationsStep)
  .commit();
