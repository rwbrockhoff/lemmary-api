import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';
import { TEST_STORE_ID, NON_APP_USER_ID } from '../../tests/test-constants.js';
import { db } from '../../db/connection.js';

describe('Workflow Stages API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('GET /workflow/order-stages returns the order stages', async () => {
		const response = await app.inject(
			withAuth('GET', '/workflow/order-stages'),
		);

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(Array.isArray(body.data)).toBe(true);
		expect(body.data.length).toBeGreaterThan(0);
		expect(body.data[0]).toHaveProperty('name');
		expect(body.data[0]).toHaveProperty('position');
	});

	it('POST /workflow/order-stages creates a new stage', async () => {
		const response = await app.inject(
			withAuth('POST', '/workflow/order-stages', {
				payload: { name: 'Packaging', color: 'lavender' },
			}),
		);

		expect(response.statusCode).toBe(201);
		const body = response.json();
		expect(body.data.name).toBe('Packaging');
		expect(body.data.color).toBe('lavender');
	});

	it('PUT /workflow/order-stages/:id updates a stage', async () => {
		const createResponse = await app.inject(
			withAuth('POST', '/workflow/order-stages', {
				payload: { name: 'Inspection', color: 'sage' },
			}),
		);
		const stageId = createResponse.json().data.id;

		const updateResponse = await app.inject(
			withAuth('PUT', `/workflow/order-stages/${stageId}`, {
				payload: { name: 'Final Inspection' },
			}),
		);

		expect(updateResponse.statusCode).toBe(200);
		expect(updateResponse.json().data.name).toBe('Final Inspection');
	});

	it('PUT /workflow/order-stages/position updates stage positions', async () => {
		const listResponse = await app.inject(
			withAuth('GET', '/workflow/order-stages'),
		);
		const stages = listResponse.json().data;
		const reversedIds = stages.map((s: { id: string }) => s.id).reverse();

		const response = await app.inject(
			withAuth('PUT', '/workflow/order-stages/position', {
				payload: { orderedIds: reversedIds },
			}),
		);

		expect(response.statusCode).toBe(200);
	});

	it('DELETE /workflow/order-stages/:id removes a stage', async () => {
		const createResponse = await app.inject(
			withAuth('POST', '/workflow/order-stages', {
				payload: { name: 'Temporary', color: 'coral' },
			}),
		);
		const stageId = createResponse.json().data.id;

		const deleteResponse = await app.inject(
			withAuth('DELETE', `/workflow/order-stages/${stageId}`),
		);

		expect(deleteResponse.statusCode).toBe(200);
	});

	it('PUT /workflow/order-stages/:id returns 404 for an unknown stage', async () => {
		const response = await app.inject(
			withAuth('PUT', `/workflow/order-stages/${NON_APP_USER_ID}`, {
				payload: { name: 'Edge Burnishing' },
			}),
		);

		expect(response.statusCode).toBe(404);
	});

	it('DELETE /workflow/order-stages/:id returns 404 for an unknown stage', async () => {
		const response = await app.inject(
			withAuth('DELETE', `/workflow/order-stages/${NON_APP_USER_ID}`),
		);

		expect(response.statusCode).toBe(404);
	});

	it('POST /workflow/order-stages returns 404 when the user has no connected store', async () => {
		const response = await app.inject(
			withAuth('POST', '/workflow/order-stages', {
				userId: NON_APP_USER_ID,
				payload: { name: 'Quality Check', color: 'sage' },
			}),
		);

		expect(response.statusCode).toBe(404);
	});

	it('GET /workflow/item-stages returns the item stages', async () => {
		const response = await app.inject(withAuth('GET', '/workflow/item-stages'));

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(Array.isArray(body.data)).toBe(true);
		expect(body.data.length).toBeGreaterThan(0);
		expect(body.data[0]).toHaveProperty('name');
		expect(body.data[0]).toHaveProperty('position');
	});

	it('POST /workflow/item-stages creates a new stage', async () => {
		const response = await app.inject(
			withAuth('POST', '/workflow/item-stages', {
				payload: { name: 'Embroidery', color: 'lavender' },
			}),
		);

		expect(response.statusCode).toBe(201);
		expect(response.json().data.name).toBe('Embroidery');
	});

	it('PUT /workflow/item-stages/:id updates a stage', async () => {
		const createResponse = await app.inject(
			withAuth('POST', '/workflow/item-stages', {
				payload: { name: 'Trimming', color: 'sage' },
			}),
		);
		const stageId = createResponse.json().data.id;

		const updateResponse = await app.inject(
			withAuth('PUT', `/workflow/item-stages/${stageId}`, {
				payload: { name: 'Final Trim' },
			}),
		);

		expect(updateResponse.statusCode).toBe(200);
		expect(updateResponse.json().data.name).toBe('Final Trim');
	});

	it('PUT /workflow/item-stages/position updates stage positions', async () => {
		const listResponse = await app.inject(
			withAuth('GET', '/workflow/item-stages'),
		);
		const stages = listResponse.json().data;
		const reversedIds = stages.map((s: { id: string }) => s.id).reverse();

		const response = await app.inject(
			withAuth('PUT', '/workflow/item-stages/position', {
				payload: { orderedIds: reversedIds },
			}),
		);

		expect(response.statusCode).toBe(200);
	});

	it('DELETE /workflow/item-stages/:id removes a stage', async () => {
		const createResponse = await app.inject(
			withAuth('POST', '/workflow/item-stages', {
				payload: { name: 'Temporary', color: 'coral' },
			}),
		);
		const stageId = createResponse.json().data.id;

		const deleteResponse = await app.inject(
			withAuth('DELETE', `/workflow/item-stages/${stageId}`),
		);

		expect(deleteResponse.statusCode).toBe(200);
	});

	it('PUT /workflow/item-stages/:id returns 404 for an unknown stage', async () => {
		const response = await app.inject(
			withAuth('PUT', `/workflow/item-stages/${NON_APP_USER_ID}`, {
				payload: { name: 'Edge Burnishing' },
			}),
		);

		expect(response.statusCode).toBe(404);
	});

	it('POST /workflow/item-stages returns 404 when the user has no connected store', async () => {
		const response = await app.inject(
			withAuth('POST', '/workflow/item-stages', {
				userId: NON_APP_USER_ID,
				payload: { name: 'Quality Check', color: 'sage' },
			}),
		);

		expect(response.statusCode).toBe(404);
	});

	async function createItemStageWithItem() {
		const createResponse = await app.inject(
			withAuth('POST', '/workflow/item-stages', {
				payload: { name: 'Doomed', color: 'coral' },
			}),
		);
		const stageId = createResponse.json().data.id;

		const item = await db
			.selectFrom('order_items')
			.innerJoin('orders', 'orders.id', 'order_items.order_id')
			.select([
				'order_items.id as itemId',
				'orders.order_number as orderNumber',
			])
			.where('orders.store_id', '=', TEST_STORE_ID)
			.executeTakeFirstOrThrow();

		await db
			.updateTable('order_items')
			.set({ workflow_stage_id: stageId })
			.where('id', '=', item.itemId)
			.execute();

		return { stageId, itemId: item.itemId, orderNumber: item.orderNumber };
	}

	it('DELETE /workflow/item-stages/:id returns 409 with affected orders when in use', async () => {
		const { stageId, orderNumber } = await createItemStageWithItem();

		const response = await app.inject(
			withAuth('DELETE', `/workflow/item-stages/${stageId}`),
		);

		expect(response.statusCode).toBe(409);
		const { details } = response.json().error;
		expect(details.affectedCount).toBeGreaterThanOrEqual(1);
		expect(
			details.affectedOrders.some(
				(order: { orderNumber: string }) => order.orderNumber === orderNumber,
			),
		).toBe(true);
		expect(details.suggestedReassignStageId).toBeTruthy();
	});

	it('DELETE /workflow/item-stages/:id returns 400 for an invalid reassign target', async () => {
		const { stageId } = await createItemStageWithItem();

		const response = await app.inject(
			withAuth(
				'DELETE',
				`/workflow/item-stages/${stageId}?reassignStageId=${NON_APP_USER_ID}`,
			),
		);

		expect(response.statusCode).toBe(400);
	});

	it('DELETE /workflow/item-stages/:id reassigns items then deletes with reassignStageId', async () => {
		const { stageId, itemId } = await createItemStageWithItem();

		const blocked = await app.inject(
			withAuth('DELETE', `/workflow/item-stages/${stageId}`),
		);
		const reassignStageId =
			blocked.json().error.details.suggestedReassignStageId;

		const response = await app.inject(
			withAuth(
				'DELETE',
				`/workflow/item-stages/${stageId}?reassignStageId=${reassignStageId}`,
			),
		);

		expect(response.statusCode).toBe(200);

		const item = await db
			.selectFrom('order_items')
			.select('workflow_stage_id')
			.where('id', '=', itemId)
			.executeTakeFirstOrThrow();
		expect(item.workflow_stage_id).toBe(reassignStageId);
	});
});
