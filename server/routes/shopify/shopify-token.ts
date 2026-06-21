import { sql } from 'kysely';
import { db } from '../../db/connection.js';
import { env } from '../../config/environment.js';
import { getShopDomain, type StoreWithAccessToken } from '../../utils/store.js';
import { refreshShopifyToken, type ShopifyTokens } from './shopify-service.js';

const EXPIRY_BUFFER_MS = 60_000;

async function persistTokens(storeId: string, tokens: ShopifyTokens) {
	await db
		.updateTable('stores')
		.set({
			store_access_token: sql<Buffer>`pgp_sym_encrypt(${tokens.accessToken}, ${env.STORE_ENCRYPTION_KEY})`,
			store_refresh_token: sql<Buffer>`pgp_sym_encrypt(${tokens.refreshToken}, ${env.STORE_ENCRYPTION_KEY})`,
			access_token_expires_at: new Date(Date.now() + tokens.expiresIn * 1000),
			updated_at: new Date(),
		})
		.where('id', '=', storeId)
		.execute();
}

// Shopify access tokens expire hourly, so refresh before use when due
export async function ensureFreshShopifyToken(
	store: StoreWithAccessToken,
): Promise<string> {
	const expiresAt = store.access_token_expires_at;
	const stillValid =
		expiresAt && expiresAt.getTime() - Date.now() > EXPIRY_BUFFER_MS;
	if (stillValid) return store.access_token;

	// No refresh token, so let the call fail and prompt a reconnect
	if (!store.refresh_token) return store.access_token;

	const tokens = await refreshShopifyToken(
		getShopDomain(store),
		store.refresh_token,
	);
	if (!tokens) return store.access_token;

	await persistTokens(store.id, tokens);
	return tokens.accessToken;
}
