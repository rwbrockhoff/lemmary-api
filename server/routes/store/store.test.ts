import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';
import {
	TEST_USER_ID,
	TEST_STORE_ID,
	NON_APP_USER_ID,
	ONBOARDING_USER_ID,
} from '../../tests/test-constants.js';
import { db } from '../../db/connection.js';
import { createDefaultStages, createShopifyStore } from './store-service.js';
import { getStoreForUser, getStoreWithAccessToken } from '../../utils/store.js';

// Squarespace Mock
vi.mock('../orders/platforms/squarespace.js', async (importOriginal) => ({
	...(await importOriginal<
		typeof import('../orders/platforms/squarespace.js')
	>()),
	testSquarespaceConnection: vi.fn().mockResolvedValue(true),
}));

// Don't call to Shopify for TZ during tests
vi.mock('../shopify/shopify-service.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../shopify/shopify-service.js')>()),
	fetchShopTimezone: vi.fn().mockResolvedValue(null),
}));

describe('Store API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('PATCH /store updates the store name', async () => {
		const response = await app.inject(
			withAuth('PATCH', '/store', {
				payload: { storeName: 'Updated Test Store' },
			}),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data.storeName).toBe('Updated Test Store');
	});

	it('PATCH /store with applyLeadTimeToOpenOrders reprices open order due dates', async () => {
		const order = await db
			.selectFrom('orders')
			.select(['id', 'order_date'])
			.where('store_id', '=', TEST_STORE_ID)
			.where('fulfillment_status', '=', 'pending')
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('PATCH', '/store', {
				payload: { leadTimeDays: 30, applyLeadTimeToOpenOrders: true },
			}),
		);
		expect(response.statusCode).toBe(200);

		const updated = await db
			.selectFrom('orders')
			.select('due_date')
			.where('id', '=', order.id)
			.executeTakeFirstOrThrow();

		const dueDay = Date.parse(updated.due_date! + 'T00:00:00Z');
		const orderDay = Date.parse(
			order.order_date.toISOString().slice(0, 10) + 'T00:00:00Z',
		);
		const diffDays = Math.round((dueDay - orderDay) / 86400000);
		expect(diffDays).toBe(30);

		// Restore the seeded lead time + reprice due dates back so other suites are unaffected
		await app.inject(
			withAuth('PATCH', '/store', {
				payload: { leadTimeDays: 14, applyLeadTimeToOpenOrders: true },
			}),
		);
	});

	it('PATCH /store returns 404 when the user has no connected store', async () => {
		const response = await app.inject(
			withAuth('PATCH', '/store', {
				userId: NON_APP_USER_ID,
				payload: { storeName: 'Twelve Stitch' },
			}),
		);

		expect(response.statusCode).toBe(404);
	});

	it('GET /store returns the connected store', async () => {
		const response = await app.inject(withAuth('GET', '/store'));

		expect(response.statusCode).toBe(200);
		const data = response.json().data;
		expect(data.connected).toBe(true);
		expect(data.storeName).toBeTruthy();
		expect(data.timezone).toBeTruthy();
	});

	it('GET /store returns connected false when the user has no store', async () => {
		const response = await app.inject(
			withAuth('GET', '/store', { userId: NON_APP_USER_ID }),
		);

		expect(response.statusCode).toBe(200);
		const data = response.json().data;
		expect(data.connected).toBe(false);
		expect(data.storeName).toBeNull();
	});

	it('POST /store creates the store with default stages', async () => {
		await db
			.insertInto('users')
			.values({
				id: ONBOARDING_USER_ID,
				email: 'onboarding-test@example.com',
				first_name: 'Onboarding',
				last_name: 'Test',
			})
			.execute();

		try {
			const response = await app.inject(
				withAuth('POST', '/store', {
					userId: ONBOARDING_USER_ID,
					payload: {
						storeName: 'Fresh Store',
						accessToken: 'test-token',
						timezone: 'America/Denver',
					},
				}),
			);

			expect(response.statusCode).toBe(201);
			const data = response.json().data;
			expect(data.connected).toBe(true);
			expect(data.storeName).toBe('Fresh Store');

			const store = await db
				.selectFrom('stores')
				.select('id')
				.where('user_id', '=', ONBOARDING_USER_ID)
				.executeTakeFirstOrThrow();
			const orderStages = await db
				.selectFrom('order_workflow_stages')
				.select('id')
				.where('store_id', '=', store.id)
				.execute();
			const itemStages = await db
				.selectFrom('order_item_workflow_stages')
				.select('id')
				.where('store_id', '=', store.id)
				.execute();

			expect(orderStages.length).toBe(4);
			expect(itemStages.length).toBe(3);
		} finally {
			await db
				.deleteFrom('stores')
				.where('user_id', '=', ONBOARDING_USER_ID)
				.execute();
			await db
				.deleteFrom('users')
				.where('id', '=', ONBOARDING_USER_ID)
				.execute();
		}
	});

	it('POST /store returns 409 when a store already exists', async () => {
		const response = await app.inject(
			withAuth('POST', '/store', {
				payload: {
					storeName: 'Duplicate Store',
					accessToken: 'test-token',
					timezone: 'America/Denver',
				},
			}),
		);

		expect(response.statusCode).toBe(409);
	});

	it('DELETE /store removes the store and its data', async () => {
		await db
			.insertInto('users')
			.values({
				id: ONBOARDING_USER_ID,
				email: 'delete-test@example.com',
				first_name: 'Delete',
				last_name: 'Test',
			})
			.execute();

		try {
			await app.inject(
				withAuth('POST', '/store', {
					userId: ONBOARDING_USER_ID,
					payload: {
						storeName: 'Disposable Store',
						accessToken: 'test-token',
						timezone: 'America/Denver',
					},
				}),
			);

			const response = await app.inject(
				withAuth('DELETE', '/store', { userId: ONBOARDING_USER_ID }),
			);

			expect(response.statusCode).toBe(200);

			const store = await getStoreForUser(ONBOARDING_USER_ID);
			expect(store).toBeNull();
		} finally {
			await db
				.deleteFrom('users')
				.where('id', '=', ONBOARDING_USER_ID)
				.execute();
		}
	});

	it('DELETE /store returns 404 when the user has no store', async () => {
		const response = await app.inject(
			withAuth('DELETE', '/store', { userId: NON_APP_USER_ID }),
		);

		expect(response.statusCode).toBe(404);
	});

	it('createShopifyStore refreshes the token in place when reconnecting', async () => {
		const shop = 'reconnect-test.myshopify.com';

		await db
			.insertInto('users')
			.values({
				id: ONBOARDING_USER_ID,
				email: 'reconnect-test@example.com',
				first_name: 'Reconnect',
				last_name: 'Test',
			})
			.execute();

		try {
			const first = await createShopifyStore(ONBOARDING_USER_ID, shop, {
				accessToken: 'token-1',
				refreshToken: 'refresh-1',
				expiresIn: 3600,
			});
			expect(first.ok).toBe(true);
			const original = await getStoreForUser(ONBOARDING_USER_ID);

			// Reconnecting the same store should update the existing row, not error
			const reconnect = await createShopifyStore(ONBOARDING_USER_ID, shop, {
				accessToken: 'token-2',
				refreshToken: 'refresh-2',
				expiresIn: 3600,
			});
			expect(reconnect.ok).toBe(true);

			const after = await getStoreWithAccessToken(ONBOARDING_USER_ID);
			expect(after?.id).toBe(original?.id);
			expect(after?.access_token).toBe('token-2');

			// A different shop while one is connected still has to be removed first
			const other = await createShopifyStore(
				ONBOARDING_USER_ID,
				'other-store.myshopify.com',
				{ accessToken: 'token-3', refreshToken: 'refresh-3', expiresIn: 3600 },
			);
			expect(other).toEqual({ ok: false, error: 'store_exists' });
		} finally {
			await db
				.deleteFrom('stores')
				.where('user_id', '=', ONBOARDING_USER_ID)
				.execute();
			await db
				.deleteFrom('users')
				.where('id', '=', ONBOARDING_USER_ID)
				.execute();
		}
	});

	it('createDefaultStages seeds the default order and item stages', async () => {
		// Run inside a transaction we roll back, so the throwaway store is never
		// committed and parallel suites sharing the test DB don't see it.
		class Rollback extends Error {}

		let orderStages: {
			name: string;
			is_default: boolean;
			is_complete: boolean;
		}[] = [];
		let itemStages: { name: string }[] = [];

		try {
			await db.transaction().execute(async (trx) => {
				const store = await trx
					.insertInto('stores')
					.values({
						user_id: TEST_USER_ID,
						platform: 'squarespace',
						store_name: 'Defaults Test Store',
						store_access_token: Buffer.from('test-token'),
					})
					.returning('id')
					.executeTakeFirstOrThrow();

				await createDefaultStages(store.id, trx);

				orderStages = await trx
					.selectFrom('order_workflow_stages')
					.select(['name', 'is_default', 'is_complete'])
					.where('store_id', '=', store.id)
					.orderBy('position', 'asc')
					.execute();
				itemStages = await trx
					.selectFrom('order_item_workflow_stages')
					.select('name')
					.where('store_id', '=', store.id)
					.orderBy('position', 'asc')
					.execute();

				throw new Rollback();
			});
		} catch (e) {
			if (!(e instanceof Rollback)) throw e;
		}

		expect(orderStages.map((s) => s.name)).toEqual([
			'New',
			'In Progress',
			'Ready to Ship',
			'Fulfilled',
		]);
		expect(orderStages.find((s) => s.is_default)?.name).toBe('New');
		expect(orderStages.find((s) => s.is_complete)?.name).toBe('Fulfilled');
		expect(itemStages.map((s) => s.name)).toEqual([
			'Not Started',
			'In Progress',
			'Done',
		]);
	});
});
