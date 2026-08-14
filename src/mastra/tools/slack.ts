import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

function isLive(): boolean {
  return !!SLACK_WEBHOOK_URL;
}

// Simulated Slack messages for demo mode
const slackMessages: Array<Record<string, unknown>> = [];

/**
 * Send a Slack notification.
 */
export const sendSlackNotificationTool = createTool({
  id: 'send-slack-notification',
  description:
    'Sends a notification to Slack. Used for escalation alerts and daily performance digests.',
  inputSchema: z.object({
    message: z.string().describe('The message to send'),
    channel: z.string().optional().describe('Channel name (used in live mode via webhook)'),
    type: z
      .enum(['escalation', 'digest', 'alert', 'info'])
      .default('info')
      .describe('Notification type for formatting'),
    metadata: z.record(z.string(), z.string()).optional().describe('Additional context fields'),
  }),
  outputSchema: z.object({
    sent: z.boolean(),
    mode: z.enum(['live', 'demo']),
  }),
  execute: async ({ message, channel, type, metadata }, _ctx) => {
    const emoji = {
      escalation: ':rotating_light:',
      digest: ':bar_chart:',
      alert: ':warning:',
      info: ':information_source:',
    }[type];

    const slackMessage = {
      text: `${emoji} *SupportFlow AI — ${type.toUpperCase()}*\n\n${message}`,
      ...(metadata
        ? {
            attachments: [
              {
                fields: Object.entries(metadata).map(([title, value]) => ({
                  title,
                  value,
                  short: true,
                })),
              },
            ],
          }
        : {}),
    };

    if (isLive()) {
      const res = await fetch(SLACK_WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackMessage),
      });
      if (!res.ok) throw new Error(`Slack webhook error: ${res.status}`);
      return { sent: true, mode: 'live' as const };
    }

    // Demo mode
    slackMessages.push({
      ...slackMessage,
      channel,
      type,
      sentAt: new Date().toISOString(),
    });
    console.log(`[Slack Demo] ${emoji} ${type}: ${message.slice(0, 100)}...`);
    return { sent: true, mode: 'demo' as const };
  },
});

/**
 * Send an escalation alert to Slack.
 */
export const sendEscalationAlertTool = createTool({
  id: 'send-escalation-alert',
  description: 'Sends an urgent escalation alert to the support team Slack channel.',
  inputSchema: z.object({
    customerEmail: z.string().optional(),
    summary: z.string().describe('Brief summary of the escalation'),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
    ticketId: z.number().optional().describe('Zendesk ticket ID if created'),
    handoffDoc: z.string().describe('Full escalation handoff document'),
  }),
  outputSchema: z.object({
    sent: z.boolean(),
    mode: z.enum(['live', 'demo']),
  }),
  execute: async ({ customerEmail, summary, urgency, ticketId, handoffDoc }) => {
    const urgencyEmoji = {
      low: ':white_circle:',
      medium: ':large_yellow_circle:',
      high: ':large_orange_circle:',
      critical: ':red_circle:',
    }[urgency];

    const message = [
      `${urgencyEmoji} *Escalation — ${urgency.toUpperCase()}*`,
      '',
      `*Customer:* ${customerEmail || 'Unknown'}`,
      `*Summary:* ${summary}`,
      ticketId ? `*Zendesk Ticket:* #${ticketId}` : '',
      '',
      '*Handoff Document:*',
      '```',
      handoffDoc.slice(0, 1500),
      '```',
    ]
      .filter(Boolean)
      .join('\n');

    // Reuse the notification tool logic
    const payload = {
      text: message,
    };

    if (isLive()) {
      const res = await fetch(SLACK_WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Slack webhook error: ${res.status}`);
      return { sent: true, mode: 'live' as const };
    }

    slackMessages.push({ ...payload, type: 'escalation', sentAt: new Date().toISOString() });
    console.log(`[Slack Demo] Escalation alert: ${summary}`);
    return { sent: true, mode: 'demo' as const };
  },
});

/**
 * Get all Slack messages (for demo/review purposes).
 */
export const getSlackMessagesTool = createTool({
  id: 'get-slack-messages',
  description: 'Returns all Slack messages sent by the system. Useful for review and audit.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    messages: z.array(z.any()),
    count: z.number(),
  }),
  execute: async () => {
    return { messages: slackMessages, count: slackMessages.length };
  },
});
