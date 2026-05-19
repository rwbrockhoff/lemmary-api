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
});
