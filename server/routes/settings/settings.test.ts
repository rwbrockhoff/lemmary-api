import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';

describe('Settings API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('GET /settings returns the store settings', async () => {
		const response = await app.inject(withAuth('GET', '/settings'));

		expect(response.statusCode).toBe(200);
		expect(response.json().success).toBe(true);
	});

	it('PUT /settings/lead-time updates the lead time', async () => {
		const original = (
			await app.inject(withAuth('GET', '/settings'))
		).json().data.leadTimeDays;

		const response = await app.inject(
			withAuth('PUT', '/settings/lead-time', {
				payload: { leadTimeDays: 21 },
			}),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().success).toBe(true);

		// Restore the seeded lead time so it doesn't leak into other test files
		await app.inject(
			withAuth('PUT', '/settings/lead-time', {
				payload: { leadTimeDays: original },
			}),
		);
	});
});
