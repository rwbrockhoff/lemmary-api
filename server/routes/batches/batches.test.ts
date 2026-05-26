import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';
import { TEST_STORE_ID } from '../../tests/test-constants.js';
import { db } from '../../db/connection.js';

describe('Batches API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('GET /batches returns an empty list when none exist', async () => {
		const response = await app.inject(withAuth('GET', '/batches'));

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(Array.isArray(body.data)).toBe(true);
		expect(body.data.length).toBe(0);
	});

	it('POST /batches creates a batch and aggregates BOM materials', async () => {
		const orders = await db
			.selectFrom('orders')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.where('fulfillment_status', '=', 'pending')
			.limit(3)
			.execute();
		const orderIds = orders.map((o) => o.id);

		const response = await app.inject(
			withAuth('POST', '/batches', {
				payload: { name: 'Test Batch', orderIds },
			}),
		);

		expect(response.statusCode).toBe(201);
		const batchId = response.json().data.id;
		expect(batchId).toBeTruthy();

		const materials = await db
			.selectFrom('production_batch_materials')
			.select(db.fn.count<number>('id').as('count'))
			.where('batch_id', '=', batchId)
			.executeTakeFirstOrThrow();
		expect(Number(materials.count)).toBeGreaterThan(0);
	});

	it('GET /batches/:batchId returns the batch with aggregated items and materials', async () => {
		const batch = await db
			.selectFrom('production_batches')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.executeTakeFirstOrThrow();

		const response = await app.inject(withAuth('GET', `/batches/${batch.id}`));

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.data.id).toBe(batch.id);
		expect(Array.isArray(body.data.orders)).toBe(true);
		expect(Array.isArray(body.data.items)).toBe(true);
		expect(Array.isArray(body.data.materials)).toBe(true);
	});

	it('PUT /batches/:batchId updates the batch name', async () => {
		const batch = await db
			.selectFrom('production_batches')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('PUT', `/batches/${batch.id}`, {
				payload: { name: 'Renamed Batch' },
			}),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data.name).toBe('Renamed Batch');
	});

	it('DELETE /batches/:batchId removes the batch', async () => {
		const orders = await db
			.selectFrom('orders')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.where('fulfillment_status', '=', 'pending')
			.limit(1)
			.execute();

		const createResponse = await app.inject(
			withAuth('POST', '/batches', {
				payload: { name: 'To Be Deleted', orderIds: orders.map((o) => o.id) },
			}),
		);
		const batchId = createResponse.json().data.id;

		const deleteResponse = await app.inject(
			withAuth('DELETE', `/batches/${batchId}`),
		);

		expect(deleteResponse.statusCode).toBe(200);
	});

	const createBatch = async () => {
		const orders = await db
			.selectFrom('orders')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.where('fulfillment_status', '=', 'pending')
			.limit(2)
			.execute();

		const res = await app.inject(
			withAuth('POST', '/batches', {
				payload: {
					name: 'Completion Test Batch',
					orderIds: orders.map((o) => o.id),
				},
			}),
		);
		return res.json().data.id as string;
	};

	it('PUT /batches/:batchId/orders/:id completes an order and cascades to its items', async () => {
		const batchId = await createBatch();
		const batchOrder = await db
			.selectFrom('production_batch_orders')
			.select('id')
			.where('batch_id', '=', batchId)
			.executeTakeFirstOrThrow();

		const res = await app.inject(
			withAuth('PUT', `/batches/${batchId}/orders/${batchOrder.id}`, {
				payload: { completed: true },
			}),
		);

		expect(res.statusCode).toBe(200);
		expect(res.json().data.completed).toBe(true);

		const items = await db
			.selectFrom('production_batch_order_items')
			.select('completed')
			.where('batch_order_id', '=', batchOrder.id)
			.execute();
		expect(items.length).toBeGreaterThan(0);
		expect(items.every((i) => i.completed)).toBe(true);
	});

	it('PUT /batches/:batchId/items/:id toggles a batch item complete', async () => {
		const batchId = await createBatch();
		const item = await db
			.selectFrom('production_batch_items')
			.select('id')
			.where('batch_id', '=', batchId)
			.executeTakeFirstOrThrow();

		const res = await app.inject(
			withAuth('PUT', `/batches/${batchId}/items/${item.id}`, {
				payload: { completed: true },
			}),
		);

		expect(res.statusCode).toBe(200);
		expect(res.json().data.completed).toBe(true);
	});

	it('PUT /batches/:batchId/materials/:id toggles a batch material complete', async () => {
		const batchId = await createBatch();
		const material = await db
			.selectFrom('production_batch_materials')
			.select('id')
			.where('batch_id', '=', batchId)
			.executeTakeFirstOrThrow();

		const res = await app.inject(
			withAuth('PUT', `/batches/${batchId}/materials/${material.id}`, {
				payload: { completed: true },
			}),
		);

		expect(res.statusCode).toBe(200);
		expect(res.json().data.completed).toBe(true);
	});

	it('PUT /batches/:batchId/order-items/:id/qty sets qty and recomputes order completion', async () => {
		const batchId = await createBatch();
		const orderItem = await db
			.selectFrom('production_batch_order_items')
			.select(['id', 'quantity'])
			.where('batch_id', '=', batchId)
			.executeTakeFirstOrThrow();

		const res = await app.inject(
			withAuth('PUT', `/batches/${batchId}/order-items/${orderItem.id}/qty`, {
				payload: { completedQty: orderItem.quantity },
			}),
		);

		expect(res.statusCode).toBe(200);
		expect(res.json().data.completed_qty).toBe(orderItem.quantity);
		expect(res.json().data.completed).toBe(true);
	});

	it('PUT /batches/:batchId/materials/:id/qty updates the completed quantity', async () => {
		const batchId = await createBatch();
		const material = await db
			.selectFrom('production_batch_materials')
			.select('id')
			.where('batch_id', '=', batchId)
			.executeTakeFirstOrThrow();

		const res = await app.inject(
			withAuth('PUT', `/batches/${batchId}/materials/${material.id}/qty`, {
				payload: { completedQty: 5 },
			}),
		);

		expect(res.statusCode).toBe(200);
		expect(res.json().data.completed_qty).toBe(5);
	});
});
