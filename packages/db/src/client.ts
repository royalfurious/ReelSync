import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export function createDatabaseClient(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 10
  });

  return drizzle(pool);
}