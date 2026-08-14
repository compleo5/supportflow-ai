import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraCompositeStore } from '@mastra/core/storage';
import {
  MastraStorageExporter,
  MastraPlatformExporter,
  Observability,
  SensitiveDataFilter,
} from '@mastra/observability';

import { triageAgent } from './agents/triage';
import { faqAgent } from './agents/faq';
import { billingAgent } from './agents/billing';
import { technicalAgent } from './agents/technical';
import { escalationAgent } from './agents/escalation';
import { responseComposerAgent } from './agents/response-composer';
import { supportPipeline } from './workflows/support-pipeline';
import { knowledgeBaseTool } from './tools/vector-query';
import { listResponsesTool, reviewResponseTool } from './tools/response-store';
import { getDashboardTool, getResponseDetailTool, submitReviewTool } from './tools/review-api';
import {
  createZendeskTicketTool,
  updateZendeskTicketTool,
  searchZendeskTicketsTool,
} from './tools/zendesk';
import { sendEmailTool, pollInboxTool, getSentEmailsTool } from './tools/email';
import {
  sendSlackNotificationTool,
  sendEscalationAlertTool,
  getSlackMessagesTool,
} from './tools/slack';

import {
  classificationAccuracyScorer,
  urgencyAccuracyScorer,
  sentimentAccuracyScorer,
  jsonFormatScorer,
  answerRelevancyScorer,
} from './evals/scorers';
import { join } from 'node:path';

// Use absolute path so ingest script and dev server share the same DB
const PROJECT_ROOT = join(import.meta.dirname, '../..');
const DB_URL = process.env.TURSO_DATABASE_URL || `file:${join(PROJECT_ROOT, 'mastra.db')}`;
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || undefined;

export const libsqlVector = new LibSQLVector({
  id: 'libsql-vector',
  url: DB_URL,
  authToken: AUTH_TOKEN,
});

export const mastra = new Mastra({
  agents: {
    'triage-agent': triageAgent,
    'faq-agent': faqAgent,
    'billing-agent': billingAgent,
    'technical-agent': technicalAgent,
    'escalation-agent': escalationAgent,
    'response-composer': responseComposerAgent,
  },
  workflows: {
    supportPipeline,
  },
  tools: {
    knowledgeBaseTool,
    listResponsesTool,
    reviewResponseTool,
    'get-dashboard': getDashboardTool,
    'get-response-detail': getResponseDetailTool,
    'submit-review': submitReviewTool,
    // Zendesk
    'create-zendesk-ticket': createZendeskTicketTool,
    'update-zendesk-ticket': updateZendeskTicketTool,
    'search-zendesk-tickets': searchZendeskTicketsTool,
    // Email
    'send-email': sendEmailTool,
    'poll-inbox': pollInboxTool,
    'get-sent-emails': getSentEmailsTool,
    // Slack
    'send-slack-notification': sendSlackNotificationTool,
    'send-escalation-alert': sendEscalationAlertTool,
    'get-slack-messages': getSlackMessagesTool,
  },
  vectors: {
    libsqlVector,
  },
  // Register scorers with the Mastra instance so Studio can discover and
  // display them under the Evals / Scorers tab.
  scorers: {
    'json-format': jsonFormatScorer,
    'classification-accuracy': classificationAccuracyScorer,
    'urgency-accuracy': urgencyAccuracyScorer,
    'sentiment-accuracy': sentimentAccuracyScorer,
    'answer-relevancy': answerRelevancyScorer,
  },
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new LibSQLStore({
      id: 'mastra-storage',
      url: DB_URL,
      authToken: AUTH_TOKEN,
    }),
    domains: {
      observability: await new DuckDBStore().getStore('observability'),
    },
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'supportflow-ai',
        exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});
