import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';
import { NON_APP_USER_ID } from '../../tests/test-constants.js';

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
});
