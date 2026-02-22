import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { env } from '../config/environment.js';
import type { Database } from './database-types.js';

const dialect = new PostgresDialect({
	pool: new pg.Pool({
		connectionString: env.DATABASE_URL,
	}),
});

export const db = new Kysely<Database>({ dialect });
