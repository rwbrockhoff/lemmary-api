import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';

describe('Workflow Stages API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('GET /workflow/stages returns the order and item stages', async () => {
		const response = await app.inject(withAuth('GET', '/workflow/stages'));

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(Array.isArray(body.data.orderStages)).toBe(true);
		expect(Array.isArray(body.data.itemStages)).toBe(true);
		expect(body.data.orderStages.length).toBeGreaterThan(0);
		expect(body.data.orderStages[0]).toHaveProperty('name');
		expect(body.data.orderStages[0]).toHaveProperty('position');
	});

	it('POST /workflow/stages creates a new stage', async () => {
		const response = await app.inject(
			withAuth('POST', '/workflow/stages', {
				payload: { name: 'Packaging', color: 'lavender' },
			}),
		);

		expect(response.statusCode).toBe(201);
		const body = response.json();
		expect(body.data.name).toBe('Packaging');
		expect(body.data.color).toBe('lavender');
	});

	it('PUT /workflow/stages/:id updates a stage', async () => {
		const createResponse = await app.inject(
			withAuth('POST', '/workflow/stages', {
				payload: { name: 'Inspection', color: 'sage' },
			}),
		);
		const stageId = createResponse.json().data.id;

		const updateResponse = await app.inject(
			withAuth('PUT', `/workflow/stages/${stageId}`, {
				payload: { name: 'Final Inspection' },
			}),
		);

		expect(updateResponse.statusCode).toBe(200);
		expect(updateResponse.json().data.name).toBe('Final Inspection');
	});

	it('PUT /workflow/stages/order updates stage positions', async () => {
		const listResponse = await app.inject(withAuth('GET', '/workflow/stages'));
		const stages = listResponse.json().data.orderStages;
		const reversedIds = stages.map((s: { id: string }) => s.id).reverse();

		const response = await app.inject(
			withAuth('PUT', '/workflow/stages/order', {
				payload: { orderedIds: reversedIds },
			}),
		);

		expect(response.statusCode).toBe(200);
	});

	it('DELETE /workflow/stages/:id removes a stage', async () => {
		const createResponse = await app.inject(
			withAuth('POST', '/workflow/stages', {
				payload: { name: 'Temporary', color: 'coral' },
			}),
		);
		const stageId = createResponse.json().data.id;

		const deleteResponse = await app.inject(
			withAuth('DELETE', `/workflow/stages/${stageId}`),
		);

		expect(deleteResponse.statusCode).toBe(200);
	});
});
