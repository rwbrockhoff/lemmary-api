import { sql, type SqlBool } from 'kysely';
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
	'logo_url',
	'tagline',
	'website_url',
	'contact_email',
	'default_production_type',
	'timezone',
	'access_token_expires_at',
	'last_synced_at',
	'created_at',
	'updated_at',
] as const;

export type StoreSummary = Omit<
	Store,
	'store_access_token' | 'store_refresh_token'
>;
export type StoreWithAccessToken = StoreSummary & {
	access_token: string;
	refresh_token: string | null;
};

// Shopify's shop domain (e.g. my-store.myshopify.com)
// is kept in platform_config.store_url
export function getShopDomain(store: StoreSummary): string {
	const config = store.platform_config as { store_url?: string } | null;
	return (config?.store_url ?? '').replace(/^https?:\/\//, '');
}

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

// Shopify webhooks identify a store by its shop domain
// use store_url we saved at connect: stored as https://{shop}
export async function getStoreByShopDomain(
	shop: string,
): Promise<StoreSummary | null> {
	const store = await db
		.selectFrom('stores')
		.select(storeSummaryColumns)
		.where('platform', '=', 'shopify')
		.where(sql<SqlBool>`platform_config->>'store_url' = ${`https://${shop}`}`)
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
			sql<
				string | null
			>`pgp_sym_decrypt(store_refresh_token, ${env.STORE_ENCRYPTION_KEY})`.as(
				'refresh_token',
			),
		])
		.where('user_id', '=', userId)
		.executeTakeFirst();

	return store ?? null;
}
