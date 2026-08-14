import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  getResponses,
  getResponseById,
  updateResponse,
  getStats,
} from './response-store';
import { processReviewedResponse } from './learning-loop';

/**
 * API tool: Get dashboard data (stats + responses).
 */
export const getDashboardTool = createTool({
  id: 'get-dashboard',
  description: 'Get the review dashboard data including stats and all responses.',
  inputSchema: z.object({
    status: z
      .enum(['pending', 'approved', 'edited', 'rejected', 'auto-sent', 'all'])
      .optional()
      .default('all'),
    limit: z.number().optional().default(50),
  }),
  outputSchema: z.object({
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
    responses: z.array(z.any()),
  }),
  execute: async ({ status, limit }) => {
    const filterStatus = status === 'all' ? undefined : status;
    const responses = getResponses(filterStatus).slice(0, limit);
    return { stats: getStats(), responses };
  },
});

/**
 * API tool: Get a single response by ID.
 */
export const getResponseDetailTool = createTool({
  id: 'get-response-detail',
  description: 'Get detailed information about a specific response.',
  inputSchema: z.object({
    id: z.string(),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    response: z.any().optional(),
  }),
  execute: async ({ id }) => {
    const response = getResponseById(id);
    return { found: !!response, response };
  },
});

/**
 * API tool: Review a response (approve/edit/reject).
 */
export const submitReviewTool = createTool({
  id: 'submit-review',
  description: 'Submit a review action for a pending response.',
  inputSchema: z.object({
    id: z.string(),
    action: z.enum(['approve', 'edit', 'reject']),
    editedReply: z.string().optional(),
    feedback: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    response: z.any().optional(),
  }),
  execute: async ({ id, action, editedReply, feedback }, { mastra }) => {
    const statusMap = { approve: 'approved', edit: 'edited', reject: 'rejected' } as const;
    const updated = updateResponse(id, {
      status: statusMap[action],
      reviewedAt: new Date().toISOString(),
      editedReply: action === 'edit' ? editedReply : undefined,
      feedback,
    });

    // Feed back into the knowledge base via the learning loop
    if (updated) {
      try {
        const vectorStore = mastra?.getVector('libsqlVector');
        if (vectorStore) {
          await processReviewedResponse(updated, vectorStore as any);
        }
      } catch (err) {
        console.error('[Learning Loop] Failed to process review:', err);
      }
    }

    return { success: !!updated, response: updated };
  },
});
