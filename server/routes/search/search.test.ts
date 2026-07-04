import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';
import {
	TEST_STORE_ID,
	OTHER_USER_ID,
	NON_APP_USER_ID,
} from '../../tests/test-constants.js';
import { db } from '../../db/connection.js';

describe('Search API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('GET /search finds orders and customers by customer name', async () => {
		const order = await db
			.selectFrom('orders')
			.select(['customer_name'])
			.where('store_id', '=', TEST_STORE_ID)
			.where('customer_name', 'is not', null)
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('GET', `/search?q=${encodeURIComponent(order.customer_name!)}`),
		);

		expect(response.statusCode).toBe(200);
		const { orders, customers } = response.json().data;
		expect(orders.length).toBeGreaterThan(0);
		expect(
			customers.some((c: { name: string }) => c.name === order.customer_name),
		).toBe(true);
	});

	it('GET /search finds an order by its order number', async () => {
		const order = await db
			.selectFrom('orders')
			.select(['order_number'])
			.where('store_id', '=', TEST_STORE_ID)
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('GET', `/search?q=${encodeURIComponent(order.order_number)}`),
		);

		expect(response.statusCode).toBe(200);
		expect(
			response
				.json()
				.data.orders.some(
					(o: { order_number: string }) =>
						o.order_number === order.order_number,
				),
		).toBe(true);
	});

	it('GET /search finds products by name', async () => {
		const product = await db
			.selectFrom('products')
			.select(['name'])
			.where('store_id', '=', TEST_STORE_ID)
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('GET', `/search?q=${encodeURIComponent(product.name)}`),
		);

		expect(response.statusCode).toBe(200);
		expect(
			response.json().data.products.map((p: { name: string }) => p.name),
		).toContain(product.name);
	});

	it('GET /search returns empty groups for a no-match query', async () => {
		const response = await app.inject(
			withAuth('GET', '/search?q=zzz-nothing-matches-xyz'),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data).toEqual({
			orders: [],
			products: [],
			customers: [],
		});
	});

	it('GET /search returns empty groups for an empty query', async () => {
		const response = await app.inject(withAuth('GET', '/search?q='));

		expect(response.statusCode).toBe(200);
		expect(response.json().data).toEqual({
			orders: [],
			products: [],
			customers: [],
		});
	});

	it('GET /search requires the q param', async () => {
		const response = await app.inject(withAuth('GET', '/search'));

		expect(response.statusCode).toBe(400);
	});

	it('GET /search does not leak another store data', async () => {
		const order = await db
			.selectFrom('orders')
			.select(['customer_email'])
			.where('store_id', '=', TEST_STORE_ID)
			.where('customer_email', 'is not', null)
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth(
				'GET',
				`/search?q=${encodeURIComponent(order.customer_email!)}`,
				{ userId: OTHER_USER_ID },
			),
		);

		expect(response.statusCode).toBe(200);
		const { orders, customers } = response.json().data;

		expect(
			customers.some(
				(c: { email: string }) => c.email === order.customer_email,
			),
		).toBe(false);

		const returnedIds = orders.map((o: { id: string }) => o.id);
		if (returnedIds.length > 0) {
			const leaked = await db
				.selectFrom('orders')
				.select('id')
				.where('store_id', '=', TEST_STORE_ID)
				.where('id', 'in', returnedIds)
				.execute();
			expect(leaked).toEqual([]);
		}
	});

	it('GET /search returns empty groups when the user has no store', async () => {
		const response = await app.inject(
			withAuth('GET', '/search?q=anything', { userId: NON_APP_USER_ID }),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data).toEqual({
			orders: [],
			products: [],
			customers: [],
		});
	});
});
