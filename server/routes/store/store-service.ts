import { sql, type UpdateObject, type InsertObject, type Kysely } from 'kysely';
import { z } from 'zod';
import { db } from '../../db/connection.js';
import { env } from '../../config/environment.js';
import {
	getStoreForUser,
	getShopDomain,
	getStoreByShopDomain,
} from '../../utils/store.js';
import { recordAuditEvent } from '../../utils/audit-logger.js';
import { cancelSubscription } from '../subscription/subscription-service.js';
import { Sentry } from '../../config/sentry.js';
import { AuditAction, type ProductionType } from '../../db/enums.js';
import { isValidTimeZone } from '../../utils/timezone.js';
import { testSquarespaceConnection } from '../orders/platforms/squarespace.js';
import {
	fetchShopTimezone,
	type ShopifyTokens,
} from '../shopify/shopify-service.js';
import {
	DEFAULT_ORDER_STAGES,
	DEFAULT_ITEM_STAGES,
} from '../../config/default-workflow-stages.js';
import type { Database } from '../../db/database-types.js';
import type {
	UpdateStoreRequestSchema,
	CreateStoreRequestSchema,
} from './contract/schemas.js';

type UpdateStoreInput = z.infer<typeof UpdateStoreRequestSchema>;
type CreateStoreInput = z.infer<typeof CreateStoreRequestSchema>;

type StoreView = {
	connected: boolean;
	storeName: string | null;
	platform: 'squarespace' | 'shopify' | 'etsy' | null;
	leadTimeDays: number | null;
	storeUrl: string | null;
	logoUrl: string | null;
	tagline: string | null;
	websiteUrl: string | null;
	contactEmail: string | null;
	defaultProductionType: ProductionType | null;
	timezone: string | null;
	lastSyncedAt: Date | null;
};

type CreateStoreResult =
	| { ok: true; store: StoreView }
	| { ok: false; error: 'store_exists' | 'invalid_token' };

type UpdateStoreSuccess = {
	ok: true;
	storeName: string;
	platform: string;
	leadTimeDays: number | null;
};

type UpdateStoreError = {
	ok: false;
	error: 'no_store' | 'invalid_token';
};

type UpdateStoreResult = UpdateStoreSuccess | UpdateStoreError;

type DeleteStoreResult = { ok: true } | { ok: false; error: 'no_store' };

export async function createDefaultStages(
	storeId: string,
	trx: Kysely<Database> = db,
) {
	await trx
		.insertInto('order_workflow_stages')
		.values(
			DEFAULT_ORDER_STAGES.map((stage) => ({ ...stage, store_id: storeId })),
		)
		.execute();

	await trx
		.insertInto('order_item_workflow_stages')
		.values(
			DEFAULT_ITEM_STAGES.map((stage) => ({ ...stage, store_id: storeId })),
		)
		.execute();
}

async function getUserEmail(userId: string): Promise<string | null> {
	const user = await db
		.selectFrom('users')
		.select('email')
		.where('id', '=', userId)
		.executeTakeFirst();

	return user?.email ?? null;
}

export async function getStore(userId: string): Promise<StoreView> {
	const store = await getStoreForUser(userId);
	if (!store) {
		return {
			connected: false,
			storeName: null,
			platform: null,
			leadTimeDays: null,
			storeUrl: null,
			logoUrl: null,
			tagline: null,
			websiteUrl: null,
			contactEmail: null,
			defaultProductionType: null,
			timezone: null,
			lastSyncedAt: null,
		};
	}

	const platformConfig = (store.platform_config ?? {}) as {
		store_url?: string | null;
	};

	return {
		connected: true,
		storeName: store.store_name,
		platform: store.platform,
		leadTimeDays: store.lead_time_days,
		storeUrl: platformConfig.store_url ?? null,
		logoUrl: store.logo_url,
		tagline: store.tagline,
		websiteUrl: store.website_url,
		contactEmail: store.contact_email,
		defaultProductionType: store.default_production_type,
		timezone: store.timezone,
		lastSyncedAt: store.last_synced_at,
	};
}

export async function createStore(
	userId: string,
	input: CreateStoreInput,
): Promise<CreateStoreResult> {
	const existing = await getStoreForUser(userId);
	if (existing) return { ok: false, error: 'store_exists' };

	const valid = await testSquarespaceConnection(input.accessToken);
	if (!valid) return { ok: false, error: 'invalid_token' };

	const platformConfig = {
		base_url: 'https://api.squarespace.com/1.0',
		api_version: '1.0',
		store_url: input.storeUrl ?? null,
	};

	const encryptedToken = sql<Buffer>`pgp_sym_encrypt(${input.accessToken}, ${env.STORE_ENCRYPTION_KEY})`;
	const contactEmail = await getUserEmail(userId);

	await db.transaction().execute(async (trx) => {
		const store = await trx
			.insertInto('stores')
			.values({
				user_id: userId,
				platform: 'squarespace',
				store_name: input.storeName,
				store_access_token: encryptedToken,
				platform_config: platformConfig,
				lead_time_days: input.leadTimeDays ?? null,
				contact_email: contactEmail,
				timezone: input.timezone,
			})
			.returning('id')
			.executeTakeFirstOrThrow();

		await createDefaultStages(store.id, trx);
	});

	return { ok: true, store: await getStore(userId) };
}

export async function createShopifyStore(
	userId: string,
	shop: string,
	tokens: ShopifyTokens,
): Promise<CreateStoreResult> {
	// Tokens already came from the OAuth exchange, so no connection test needed
	const encryptedAccess = sql<Buffer>`pgp_sym_encrypt(${tokens.accessToken}, ${env.STORE_ENCRYPTION_KEY})`;
	const encryptedRefresh = sql<Buffer>`pgp_sym_encrypt(${tokens.refreshToken}, ${env.STORE_ENCRYPTION_KEY})`;
	const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

	const existing = await getStoreForUser(userId);
	if (existing) {
		// Reconnecting the same Shopify store just refreshes the token in place so
		// the merchant keeps all their orders and BOM data. A different store still
		// has to be removed first.
		const isSameShopifyStore =
			existing.platform === 'shopify' && getShopDomain(existing) === shop;
		if (!isSameShopifyStore) return { ok: false, error: 'store_exists' };

		await db
			.updateTable('stores')
			.set({
				store_access_token: encryptedAccess,
				store_refresh_token: encryptedRefresh,
				access_token_expires_at: expiresAt,
				updated_at: new Date(),
			})
			.where('id', '=', existing.id)
			.execute();

		return { ok: true, store: await getStore(userId) };
	}

	const platformConfig = { store_url: `https://${shop}` };
	const shopTimezone = await fetchShopTimezone(shop, tokens.accessToken);
	const contactEmail = await getUserEmail(userId);

	const values: InsertObject<Database, 'stores'> = {
		user_id: userId,
		platform: 'shopify',
		store_name: shop,
		store_access_token: encryptedAccess,
		store_refresh_token: encryptedRefresh,
		access_token_expires_at: expiresAt,
		platform_config: platformConfig,
		lead_time_days: null,
		contact_email: contactEmail,
	};
	if (shopTimezone && isValidTimeZone(shopTimezone)) {
		values.timezone = shopTimezone;
	}

	await db.transaction().execute(async (trx) => {
		const store = await trx
			.insertInto('stores')
			.values(values)
			.returning('id')
			.executeTakeFirstOrThrow();

		await createDefaultStages(store.id, trx);
	});

	return { ok: true, store: await getStore(userId) };
}

export async function updateStore(
	userId: string,
	updates: UpdateStoreInput,
): Promise<UpdateStoreResult> {
	const store = await getStoreForUser(userId);
	if (!store) return { ok: false, error: 'no_store' };

	if (updates.accessToken && store.platform === 'squarespace') {
		const valid = await testSquarespaceConnection(updates.accessToken);
		if (!valid) return { ok: false, error: 'invalid_token' };
	}

	const set: UpdateObject<Database, 'stores'> = { updated_at: new Date() };

	if (updates.storeName !== undefined) {
		set.store_name = updates.storeName;
	}

	if (updates.leadTimeDays !== undefined) {
		set.lead_time_days = updates.leadTimeDays;
	}

	if (updates.timezone !== undefined) {
		set.timezone = updates.timezone;
	}

	if (updates.logoUrl !== undefined) {
		set.logo_url = updates.logoUrl;
	}

	if (updates.tagline !== undefined) {
		set.tagline = updates.tagline;
	}

	if (updates.websiteUrl !== undefined) {
		set.website_url = updates.websiteUrl;
	}

	if (updates.contactEmail !== undefined) {
		set.contact_email = updates.contactEmail;
	}

	if (updates.defaultProductionType !== undefined) {
		set.default_production_type = updates.defaultProductionType;
	}

	if (updates.accessToken) {
		set.store_access_token = sql<Buffer>`pgp_sym_encrypt(${updates.accessToken}, ${env.STORE_ENCRYPTION_KEY})`;
	}

	if (updates.storeUrl !== undefined) {
		const existingConfig = (store.platform_config ?? {}) as Record<
			string,
			unknown
		>;
		set.platform_config = { ...existingConfig, store_url: updates.storeUrl };
	}

	await db.transaction().execute(async (trx) => {
		await trx
			.updateTable('stores')
			.set(set)
			.where('id', '=', store.id)
			.execute();

		// apply bulk flag: Update pending orders to match updated lead time
		if (
			updates.applyLeadTimeToOpenOrders &&
			updates.leadTimeDays !== undefined
		) {
			const newDueDate =
				updates.leadTimeDays === null
					? sql<string | null>`NULL`
					: sql<string>`(order_date + INTERVAL '1 day' * ${updates.leadTimeDays})::date`;

			await trx
				.updateTable('orders')
				.set({ due_date: newDueDate, updated_at: sql`NOW()` })
				.where('store_id', '=', store.id)
				.where('fulfillment_status', '=', 'pending')
				.execute();
		}
	});

	const updated = await getStoreForUser(userId);
	if (!updated) return { ok: false, error: 'no_store' };

	return {
		ok: true,
		storeName: updated.store_name,
		platform: updated.platform,
		leadTimeDays: updated.lead_time_days,
	};
}

export async function deleteStore(userId: string): Promise<DeleteStoreResult> {
	const store = await getStoreForUser(userId);
	if (!store) return { ok: false, error: 'no_store' };

	// Cancel Shopify subscription while we have token
	if (store.platform === 'shopify') {
		try {
			await cancelSubscription(userId);
		} catch (err) {
			Sentry.captureException(err, {
				tags: { operation: 'cancel_subscription_on_store_removal' },
				extra: { storeId: store.id, userId },
			});
		}
	}

	// Cascades to orders, items, BOM, materials, workflow stages, and batches
	await db.transaction().execute(async (trx) => {
		await trx
			.deleteFrom('stores')
			.where('id', '=', store.id)
			.where('user_id', '=', userId)
			.execute();

		// Save to audit log
		await recordAuditEvent(
			{
				action: AuditAction.StoreRemoved,
				platform: store.platform,
				storeId: store.id,
				userId,
			},
			trx,
		);
	});

	return { ok: true };
}

// Used by Shopify shop/redact webhook, which only knows the shop domain
export async function deleteStoreByShopDomain(shop: string): Promise<boolean> {
	const store = await getStoreByShopDomain(shop);
	if (!store) return false;

	await db.transaction().execute(async (trx) => {
		await trx.deleteFrom('stores').where('id', '=', store.id).execute();

		await recordAuditEvent(
			{
				action: AuditAction.StoreRemoved,
				platform: store.platform,
				storeId: store.id,
			},
			trx,
		);
	});

	return true;
}
