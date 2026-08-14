import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/db/src/schema.ts',
  out: './packages/db/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://watch_party:watch_party@localhost:5432/watch_party'
  }
});