import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';

describe('Reports API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('GET /reports/production-summary returns combined production data', async () => {
		const response = await app.inject(
			withAuth('GET', '/reports/production-summary'),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().success).toBe(true);
	});

	it('GET /reports/materials returns the materials report', async () => {
		const response = await app.inject(withAuth('GET', '/reports/materials'));

		expect(response.statusCode).toBe(200);
		expect(response.json().success).toBe(true);
	});
});
