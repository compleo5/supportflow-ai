import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const ZENDESK_DOMAIN = process.env.ZENDESK_DOMAIN; // e.g. "yourcompany.zendesk.com"
const ZENDESK_EMAIL = process.env.ZENDESK_EMAIL;
const ZENDESK_API_TOKEN = process.env.ZENDESK_API_TOKEN;

function isLive(): boolean {
  return !!(ZENDESK_DOMAIN && ZENDESK_EMAIL && ZENDESK_API_TOKEN);
}

async function zendeskFetch(path: string, options: RequestInit = {}) {
  const url = `https://${ZENDESK_DOMAIN}/api/v2${path}`;
  const auth = Buffer.from(`${ZENDESK_EMAIL}/token:${ZENDESK_API_TOKEN}`).toString('base64');
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Zendesk API error: ${res.status} ${await res.text()}`);
  return res.json();
}

// Simulated ticket store for demo mode
let ticketCounter = 1000;
const mockTickets: Map<number, Record<string, unknown>> = new Map();

/**
 * Create a Zendesk ticket.
 */
export const createZendeskTicketTool = createTool({
  id: 'create-zendesk-ticket',
  description:
    'Creates a support ticket in Zendesk. Used when escalating issues or tracking customer interactions.',
  inputSchema: z.object({
    subject: z.string().describe('Ticket subject line'),
    description: z.string().describe('Full ticket description / handoff document'),
    requesterEmail: z.string().optional().describe('Customer email address'),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    tags: z.array(z.string()).optional().describe('Tags for categorization'),
    customFields: z
      .record(z.string(), z.string())
      .optional()
      .describe('Custom field values (e.g. classification, confidence)'),
  }),
  outputSchema: z.object({
    ticketId: z.number(),
    ticketUrl: z.string(),
    mode: z.enum(['live', 'demo']),
  }),
  execute: async ({ subject, description, requesterEmail, priority, tags, customFields }, _ctx) => {
    if (isLive()) {
      const data = await zendeskFetch('/tickets.json', {
        method: 'POST',
        body: JSON.stringify({
          ticket: {
            subject,
            comment: { body: description },
            requester: requesterEmail ? { email: requesterEmail } : undefined,
            priority,
            tags: tags || [],
          },
        }),
      });
      const ticket = data.ticket;
      return {
        ticketId: ticket.id,
        ticketUrl: `https://${ZENDESK_DOMAIN}/agent/tickets/${ticket.id}`,
        mode: 'live' as const,
      };
    }

    // Demo mode
    const id = ++ticketCounter;
    mockTickets.set(id, {
      id,
      subject,
      description,
      requesterEmail,
      priority,
      tags,
      customFields,
      status: 'new',
      createdAt: new Date().toISOString(),
    });
    console.log(`[Zendesk Demo] Created ticket #${id}: ${subject}`);
    return {
      ticketId: id,
      ticketUrl: `https://demo.zendesk.com/agent/tickets/${id}`,
      mode: 'demo' as const,
    };
  },
});

/**
 * Update a Zendesk ticket.
 */
export const updateZendeskTicketTool = createTool({
  id: 'update-zendesk-ticket',
  description: 'Updates an existing Zendesk ticket with new information or status change.',
  inputSchema: z.object({
    ticketId: z.number().describe('Zendesk ticket ID'),
    comment: z.string().optional().describe('Add a comment to the ticket'),
    status: z.enum(['new', 'open', 'pending', 'hold', 'solved', 'closed']).optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    tags: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    mode: z.enum(['live', 'demo']),
  }),
  execute: async ({ ticketId, comment, status, priority, tags }) => {
    if (isLive()) {
      const update: Record<string, unknown> = {};
      if (comment) update.comment = { body: comment, public: false };
      if (status) update.status = status;
      if (priority) update.priority = priority;
      if (tags) update.tags = tags;

      await zendeskFetch(`/tickets/${ticketId}.json`, {
        method: 'PUT',
        body: JSON.stringify({ ticket: update }),
      });
      return { success: true, mode: 'live' as const };
    }

    // Demo mode
    const ticket = mockTickets.get(ticketId);
    if (ticket) {
      if (status) ticket.status = status;
      if (priority) ticket.priority = priority;
      if (comment) (ticket as any).lastComment = comment;
      console.log(`[Zendesk Demo] Updated ticket #${ticketId}: status=${status || 'unchanged'}`);
    }
    return { success: !!ticket, mode: 'demo' as const };
  },
});

/**
 * Search Zendesk for customer's existing tickets.
 */
export const searchZendeskTicketsTool = createTool({
  id: 'search-zendesk-tickets',
  description: "Search Zendesk for a customer's existing tickets to provide context.",
  inputSchema: z.object({
    requesterEmail: z.string().describe('Customer email to search for'),
  }),
  outputSchema: z.object({
    tickets: z.array(
      z.object({
        id: z.number(),
        subject: z.string(),
        status: z.string(),
        priority: z.string(),
        createdAt: z.string(),
      }),
    ),
    mode: z.enum(['live', 'demo']),
  }),
  execute: async ({ requesterEmail }) => {
    if (isLive()) {
      const data = await zendeskFetch(
        `/search.json?query=type:ticket requester:${encodeURIComponent(requesterEmail)}`,
      );
      return {
        tickets: (data.results || []).slice(0, 10).map((t: any) => ({
          id: t.id,
          subject: t.subject,
          status: t.status,
          priority: t.priority || 'normal',
          createdAt: t.created_at,
        })),
        mode: 'live' as const,
      };
    }

    // Demo mode — return simulated history
    const mockHistory = Array.from(mockTickets.values())
      .filter((t: any) => t.requesterEmail === requesterEmail)
      .map((t: any) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        priority: t.priority || 'normal',
        createdAt: t.createdAt,
      }));
    return { tickets: mockHistory, mode: 'demo' as const };
  },
});
