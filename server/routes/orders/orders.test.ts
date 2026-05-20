import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';
import { TEST_STORE_ID } from '../../tests/test-constants.js';
import { db } from '../../db/connection.js';

describe('Orders API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('GET /orders returns the store orders', async () => {
		const response = await app.inject(withAuth('GET', '/orders'));

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.success).toBe(true);
		expect(Array.isArray(body.data.orders)).toBe(true);
		expect(body.data.orders.length).toBeGreaterThan(0);
	});

	it('GET /orders/:orderId returns a single order with items', async () => {
		const order = await db
			.selectFrom('orders')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.executeTakeFirstOrThrow();

		const response = await app.inject(withAuth('GET', `/orders/${order.id}`));

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.data.id).toBe(order.id);
		expect(Array.isArray(body.data.items)).toBe(true);
	});

	it('PUT /orders/:orderId/stage updates the stage and records a transition', async () => {
		const order = await db
			.selectFrom('orders')
			.select(['id', 'workflow_stage_id'])
			.where('store_id', '=', TEST_STORE_ID)
			.where('fulfillment_status', '=', 'pending')
			.executeTakeFirstOrThrow();

		const newStage = await db
			.selectFrom('order_workflow_stages')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.where('id', '!=', order.workflow_stage_id)
			.executeTakeFirstOrThrow();

		const historyBefore = await db
			.selectFrom('order_stage_history')
			.select(db.fn.count<number>('id').as('count'))
			.where('order_id', '=', order.id)
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('PUT', `/orders/${order.id}/stage`, {
				payload: { stageId: newStage.id },
			}),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data.workflow_stage_id).toBe(newStage.id);

		const historyAfter = await db
			.selectFrom('order_stage_history')
			.select(db.fn.count<number>('id').as('count'))
			.where('order_id', '=', order.id)
			.executeTakeFirstOrThrow();

		expect(Number(historyAfter.count)).toBe(Number(historyBefore.count) + 1);
	});

	it('GET /orders/with-items returns orders with their line items', async () => {
		const response = await app.inject(withAuth('GET', '/orders/with-items'));

		expect(response.statusCode).toBe(200);
		expect(response.json().success).toBe(true);
	});

	it('GET /orders/completed returns fulfilled orders', async () => {
		const response = await app.inject(withAuth('GET', '/orders/completed'));

		expect(response.statusCode).toBe(200);
		expect(response.json().success).toBe(true);
	});

	it('GET /orders/workflow-board returns the kanban view', async () => {
		const response = await app.inject(
			withAuth('GET', '/orders/workflow-board'),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().success).toBe(true);
	});

	it('PUT /orders/:orderId/notes updates the notes', async () => {
		const order = await db
			.selectFrom('orders')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('PUT', `/orders/${order.id}/notes`, {
				payload: { notes: 'Customer requested rush shipping.' },
			}),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data.order_notes).toBe(
			'Customer requested rush shipping.',
		);
	});
});
