import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { join } from 'node:path';

const PROJECT_ROOT = join(import.meta.dirname, '../..');
const DB_URL = process.env.TURSO_DATABASE_URL || `file:${join(PROJECT_ROOT, 'mastra.db')}`;
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || undefined;

export const sharedMemory = new Memory({
  storage: new LibSQLStore({
    id: 'memory-storage',
    url: DB_URL,
    authToken: AUTH_TOKEN,
  }),
  options: {
    lastMessages: 20,
    generateTitle: true,
  },
});
