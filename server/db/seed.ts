import 'dotenv/config';
import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import type { Database } from './database-types.js';
import { DEV_USER_ID, DEV_STORE_ID } from '../config/constants.js';

async function seed() {
	const db = new Kysely<Database>({
		dialect: new PostgresDialect({
			pool: new pg.Pool({
				connectionString: process.env.DATABASE_URL,
			}),
		}),
	});

	console.log('Seeding development data...');

	await db
		.insertInto('users')
		.values({
			id: DEV_USER_ID,
			email: 'jaclyn@salkadesigns.com',
			full_name: 'Jaclyn Cage',
		})
		.onConflict((oc) => oc.column('id').doNothing())
		.execute();

	await db
		.insertInto('stores')
		.values({
			id: DEV_STORE_ID,
			user_id: DEV_USER_ID,
			platform: 'squarespace',
			store_name: 'Salka Designs',
			api_key: process.env.SQUARESPACE_API_KEY ?? '',
			platform_config: {
				base_url: 'https://api.squarespace.com/1.0',
				api_version: '1.0',
			},
		})
		.onConflict((oc) => oc.column('id').doNothing())
		.execute();

	await db.destroy();
	console.log('Seed complete');
}

seed();
