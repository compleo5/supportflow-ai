import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'support@supportflow.io';

function isLive(): boolean {
  return !!RESEND_API_KEY;
}

// Simulated sent emails for demo mode
const sentEmails: Array<Record<string, unknown>> = [];

/**
 * Send an email reply to a customer.
 */
export const sendEmailTool = createTool({
  id: 'send-email',
  description: 'Sends an email reply to a customer. Used after a response is approved or auto-sent.',
  inputSchema: z.object({
    to: z.string().describe('Recipient email address'),
    subject: z.string().describe('Email subject line'),
    body: z.string().describe('Email body text'),
    inReplyTo: z.string().optional().describe('Message-ID for threading'),
  }),
  outputSchema: z.object({
    sent: z.boolean(),
    messageId: z.string(),
    mode: z.enum(['live', 'demo']),
  }),
  execute: async ({ to, subject, body, inReplyTo }) => {
    if (isLive()) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to,
          subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
          text: body,
          ...(inReplyTo ? { headers: { 'In-Reply-To': inReplyTo } } : {}),
        }),
      });

      if (!res.ok) throw new Error(`Resend API error: ${res.status} ${await res.text()}`);
      const data = await res.json();
      return { sent: true, messageId: data.id, mode: 'live' as const };
    }

    // Demo mode
    const messageId = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sentEmails.push({
      messageId,
      to,
      subject,
      body,
      from: FROM_EMAIL,
      sentAt: new Date().toISOString(),
    });
    console.log(`[Email Demo] Sent to ${to}: "${subject}"`);
    return { sent: true, messageId, mode: 'demo' as const };
  },
});

/**
 * Poll for new inbound emails (simulated for demo).
 * In production, this would use Gmail API with a service account.
 */
export const pollInboxTool = createTool({
  id: 'poll-inbox',
  description: 'Polls for new inbound support emails. Returns unprocessed emails.',
  inputSchema: z.object({
    maxResults: z.number().optional().default(10),
  }),
  outputSchema: z.object({
    emails: z.array(
      z.object({
        id: z.string(),
        from: z.string(),
        subject: z.string(),
        body: z.string(),
        receivedAt: z.string(),
      }),
    ),
    mode: z.enum(['live', 'demo']),
  }),
  execute: async ({ maxResults }) => {
    // Demo mode — return sample emails for testing
    const sampleEmails = [
      {
        id: `inbox-${Date.now()}-1`,
        from: 'sarah@example.com',
        subject: "Can't login",
        body: "How do I reset my password? I've been locked out of my account for 2 hours.",
        receivedAt: new Date().toISOString(),
      },
      {
        id: `inbox-${Date.now()}-2`,
        from: 'mike@company.com',
        subject: 'Refund request',
        body: 'I want a refund for my last payment of $79. I downgraded to Starter 3 days ago.',
        receivedAt: new Date().toISOString(),
      },
    ];
    console.log(`[Email Demo] Polled inbox: ${sampleEmails.length} emails`);
    return { emails: sampleEmails.slice(0, maxResults), mode: 'demo' as const };
  },
});

/**
 * Get all sent emails (for demo/review purposes).
 */
export const getSentEmailsTool = createTool({
  id: 'get-sent-emails',
  description: 'Returns all emails sent by the system. Useful for review and audit.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    emails: z.array(z.any()),
    count: z.number(),
  }),
  execute: async () => {
    return { emails: sentEmails, count: sentEmails.length };
  },
});
