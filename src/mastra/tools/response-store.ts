
import { createHash } from 'node:crypto';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Response record schema — stored in LibSQL for the review UI.
 */
export const responseRecordSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  // Original email
  emailBody: z.string(),
  senderEmail: z.string().optional(),
  subject: z.string().optional(),
  // Triage results
  classification: z.string(),
  urgency: z.string(),
  sentiment: z.string(),
  customerTier: z.string(),
  // Agent response
  reply: z.string(),
  emailReply: z.string(),
  confidenceScore: z.number(),
  handledBy: z.string(),
  // Confidence gate
  autoSent: z.boolean(),
  // Review
  status: z.enum(['pending', 'approved', 'edited', 'rejected', 'auto-sent']),
  reviewedAt: z.string().optional(),
  editedReply: z.string().optional(),
  feedback: z.string().optional(),
  // Prompt versioning
  promptVersion: z.string(),
});

export type ResponseRecord = z.infer<typeof responseRecordSchema>;

// In-memory store for Phase 3 (production would use LibSQL table)
const responses: Map<string, ResponseRecord> = new Map();

/**
 * Generate a prompt version hash from agent instructions.
 */
export function getPromptVersion(agentId: string, instructions: string): string {
  const hash = createHash('sha256').update(`${agentId}:${instructions}`).digest('hex');
  return hash.slice(0, 8);
}

/**
 * Store a response record.
 */
export function storeResponse(record: ResponseRecord): void {
  responses.set(record.id, record);
}

/**
 * Get all responses, optionally filtered by status.
 */
export function getResponses(status?: ResponseRecord['status']): ResponseRecord[] {
  const all = Array.from(responses.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  if (status) return all.filter(r => r.status === status);
  return all;
}

/**
 * Get a single response by ID.
 */
export function getResponseById(id: string): ResponseRecord | undefined {
  return responses.get(id);
}

/**
 * Update a response (for review actions).
 */
export function updateResponse(
  id: string,
  update: Partial<ResponseRecord>,
): ResponseRecord | undefined {
  const existing = responses.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...update };
  responses.set(id, updated);
  return updated;
}

/**
 * Get dashboard stats.
 */
export function getStats() {
  const all = Array.from(responses.values());
  const total = all.length;
  const pending = all.filter(r => r.status === 'pending').length;
  const autoSent = all.filter(r => r.status === 'auto-sent').length;
  const approved = all.filter(r => r.status === 'approved').length;
  const edited = all.filter(r => r.status === 'edited').length;
  const rejected = all.filter(r => r.status === 'rejected').length;
  const avgConfidence =
    total > 0 ? Math.round(all.reduce((sum, r) => sum + r.confidenceScore, 0) / total) : 0;
  const autoSendRate = total > 0 ? Math.round((autoSent / total) * 100) : 0;

  return { total, pending, autoSent, approved, edited, rejected, avgConfidence, autoSendRate };
}

// --- Mastra tools for API access ---

export const listResponsesTool = createTool({
  id: 'list-responses',
  description: 'List all support responses, optionally filtered by review status.',
  inputSchema: z.object({
    status: z
      .enum(['pending', 'approved', 'edited', 'rejected', 'auto-sent'])
      .optional()
      .describe('Filter by review status'),
  }),
  outputSchema: z.object({
    responses: z.array(responseRecordSchema),
    stats: z.object({
      total: z.number(),
      pending: z.number(),
      autoSent: z.number(),
      approved: z.number(),
      edited: z.number(),
      rejected: z.number(),
      avgConfidence: z.number(),
      autoSendRate: z.number(),
    }),
  }),
  execute: async ({ status }) => {
    return {
      responses: getResponses(status),
      stats: getStats(),
    };
  },
});

export const reviewResponseTool = createTool({
  id: 'review-response',
  description: 'Approve, edit, or reject a pending support response.',
  inputSchema: z.object({
    id: z.string().describe('Response ID to review'),
    action: z.enum(['approve', 'edit', 'reject']).describe('Review action'),
    editedReply: z.string().optional().describe('Edited reply text (required for edit action)'),
    feedback: z.string().optional().describe('Feedback for the learning loop'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    response: responseRecordSchema.optional(),
  }),
  execute: async ({ id, action, editedReply, feedback }) => {
    const statusMap = { approve: 'approved', edit: 'edited', reject: 'rejected' } as const;
    const updated = updateResponse(id, {
      status: statusMap[action],
      reviewedAt: new Date().toISOString(),
      editedReply: action === 'edit' ? editedReply : undefined,
      feedback,
    });
    return { success: !!updated, response: updated };
  },
});
