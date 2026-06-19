import { sql, type UpdateObject, type Kysely } from 'kysely';
import { z } from 'zod';
import { db } from '../../db/connection.js';
import { env } from '../../config/environment.js';
import { getStoreForUser } from '../../utils/store.js';
import { testSquarespaceConnection } from '../orders/platforms/squarespace.js';
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
	timezone: string | null;
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

export async function getStore(userId: string): Promise<StoreView> {
	const store = await getStoreForUser(userId);
	if (!store) {
		return {
			connected: false,
			storeName: null,
			platform: null,
			leadTimeDays: null,
			storeUrl: null,
			timezone: null,
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
		timezone: store.timezone,
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
				timezone: input.timezone,
			})
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
