import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';
import { TEST_STORE_ID } from '../../tests/test-constants.js';
import { db } from '../../db/connection.js';

describe('Customers API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('GET /customers/:email returns customer with order history', async () => {
		const order = await db
			.selectFrom('orders')
			.select(['customer_email', 'customer_name'])
			.where('store_id', '=', TEST_STORE_ID)
			.where('customer_email', 'is not', null)
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('GET', `/customers/${encodeURIComponent(order.customer_email!)}`),
		);

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.data.email).toBe(order.customer_email);
		expect(body.data.name).toBe(order.customer_name);
		expect(body.data.orderCount).toBeGreaterThan(0);
		expect(Array.isArray(body.data.orders)).toBe(true);
		expect(body.data.orders.length).toBe(body.data.orderCount);
	});

	it('GET /customers/:email computes a valid tier', async () => {
		const order = await db
			.selectFrom('orders')
			.select('customer_email')
			.where('store_id', '=', TEST_STORE_ID)
			.where('customer_email', 'is not', null)
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('GET', `/customers/${encodeURIComponent(order.customer_email!)}`),
		);

		expect(response.statusCode).toBe(200);
		expect(['new', 'loyal', 'super_fan']).toContain(response.json().data.tier);
	});

	it('GET /customers/:email returns the sum of subtotals as lifetime spend', async () => {
		const order = await db
			.selectFrom('orders')
			.select('customer_email')
			.where('store_id', '=', TEST_STORE_ID)
			.where('customer_email', 'is not', null)
			.executeTakeFirstOrThrow();

		const expected = await db
			.selectFrom('orders')
			.select((eb) => eb.fn.sum('subtotal').as('total'))
			.where('store_id', '=', TEST_STORE_ID)
			.where('customer_email', '=', order.customer_email!)
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('GET', `/customers/${encodeURIComponent(order.customer_email!)}`),
		);

		expect(response.statusCode).toBe(200);
		expect(Number(response.json().data.lifetimeSpend)).toBeCloseTo(
			Number(expected.total),
			2,
		);
	});

	it('GET /customers/:email returns 404 for an unknown customer', async () => {
		const response = await app.inject(
			withAuth('GET', '/customers/unknown@example.com'),
		);

		expect(response.statusCode).toBe(404);
	});
});
