import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

const envPath = fileURLToPath(new URL('../../../../.env', import.meta.url));
loadEnv({ path: envPath });

const emptyStringToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim().length === 0 ? undefined : value;

const optionalString = () => z.preprocess(emptyStringToUndefined, z.string().optional());
const optionalUrl = () => z.preprocess(emptyStringToUndefined, z.string().url().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: optionalString(),
  REDIS_URL: optionalString(),
  BETTER_AUTH_SECRET: optionalString(),
  NEXT_PUBLIC_APP_URL: z.preprocess(emptyStringToUndefined, z.string().url().default('http://localhost:3000')),
  LIVEKIT_URL: optionalUrl(),
  LIVEKIT_API_KEY: optionalString(),
  LIVEKIT_API_SECRET: optionalString(),
  NEXT_PUBLIC_LIVEKIT_URL: optionalString()
});

export const env = envSchema.parse(process.env);