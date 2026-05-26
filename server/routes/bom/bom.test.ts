import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';

describe('BOM API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('GET /bom/material-types returns the configured material types', async () => {
		const response = await app.inject(withAuth('GET', '/bom/material-types'));

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(Array.isArray(body.data)).toBe(true);
		expect(body.data.length).toBeGreaterThan(0);
	});

	it('GET /bom/materials/catalog returns the materials catalog', async () => {
		const response = await app.inject(
			withAuth('GET', '/bom/materials/catalog'),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().success).toBe(true);
	});

	it('POST /bom creates a BOM item', async () => {
		const response = await app.inject(
			withAuth('POST', '/bom', {
				payload: {
					measurement: 'count',
					platform_sku: 'TEST-SKU-NEW',
					product_name: 'Test Product',
					variant: null,
					piece: 'Test Piece',
					length: null,
					quantity: 2,
					material_id: null,
				},
			}),
		);

		expect(response.statusCode).toBe(201);
		expect(response.json().data.piece).toBe('Test Piece');
	});

	it('PUT /bom/:bomItemId updates a BOM item', async () => {
		const created = await app.inject(
			withAuth('POST', '/bom', {
				payload: {
					measurement: 'count',
					platform_sku: 'TEST-SKU-UPDATE',
					product_name: 'Test Product',
					variant: null,
					piece: 'Original Piece',
					length: null,
					quantity: 1,
					material_id: null,
				},
			}),
		);
		const bomItemId = created.json().data.id;

		const response = await app.inject(
			withAuth('PUT', `/bom/${bomItemId}`, {
				payload: {
					piece: 'Updated Piece',
					length: null,
					quantity: 3,
					measurement: 'count',
					material_type_id: null,
					material_type_name: null,
					color: null,
					size: null,
					purchase_url: null,
				},
			}),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data.piece).toBe('Updated Piece');
		expect(response.json().data.quantity).toBe(3);
	});

	it('DELETE /bom/:bomItemId deletes a BOM item', async () => {
		const created = await app.inject(
			withAuth('POST', '/bom', {
				payload: {
					measurement: 'count',
					platform_sku: 'TEST-SKU-DELETE',
					product_name: 'Test Product',
					variant: null,
					piece: 'Deletable Piece',
					length: null,
					quantity: 1,
					material_id: null,
				},
			}),
		);
		const bomItemId = created.json().data.id;

		const response = await app.inject(withAuth('DELETE', `/bom/${bomItemId}`));
		expect(response.statusCode).toBe(200);
	});
});
