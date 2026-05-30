import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { env } from '../config/environment.js';
import type { Database } from './database-types.js';

// Parse bigint as numbers so count() results come back as numbers, not strings.
// Numeric columns (subtotal, grand_total) stay as strings to keep currency precision.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => parseInt(v, 10));

const dialect = new PostgresDialect({
	pool: new pg.Pool({
		connectionString: env.DATABASE_URL,
	}),
});

export const db = new Kysely<Database>({ dialect });
