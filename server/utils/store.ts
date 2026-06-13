import { sql } from 'kysely';
import { db } from '../db/connection.js';
import { env } from '../config/environment.js';
import type { Store } from '../db/database-types.js';

const storeSummaryColumns = [
	'id',
	'user_id',
	'platform',
	'store_name',
	'platform_config',
	'lead_time_days',
	'timezone',
	'last_synced_at',
	'created_at',
	'updated_at',
] as const;

export type StoreSummary = Omit<Store, 'store_access_token'>;
export type StoreWithAccessToken = StoreSummary & { access_token: string };

export async function getStoreForUser(
	userId: string,
): Promise<StoreSummary | null> {
	const store = await db
		.selectFrom('stores')
		.select(storeSummaryColumns)
		.where('user_id', '=', userId)
		.executeTakeFirst();

	return store ?? null;
}

export async function getStoreWithAccessToken(
	userId: string,
): Promise<StoreWithAccessToken | null> {
	const store = await db
		.selectFrom('stores')
		.select([
			...storeSummaryColumns,
			sql<string>`pgp_sym_decrypt(store_access_token, ${env.STORE_ENCRYPTION_KEY})`.as(
				'access_token',
			),
		])
		.where('user_id', '=', userId)
		.executeTakeFirst();

	return store ?? null;
}
