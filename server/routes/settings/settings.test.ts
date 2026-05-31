import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';
import { NON_APP_USER_ID } from '../../tests/test-constants.js';

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

	it('GET /settings returns null fields when the user has no connected store', async () => {
		const response = await app.inject(
			withAuth('GET', '/settings', {
				userId: NON_APP_USER_ID,
			}),
		);

		expect(response.statusCode).toBe(200);
		const data = response.json().data;
		expect(data.storeName).toBeNull();
		expect(data.platform).toBeNull();
		expect(data.leadTimeDays).toBeNull();
	});

	it('PUT /settings/lead-time rejects when the user has no connected store', async () => {
		const response = await app.inject(
			withAuth('PUT', '/settings/lead-time', {
				userId: NON_APP_USER_ID,
				payload: { leadTimeDays: 14 },
			}),
		);

		expect(response.statusCode).toBe(400);
	});

	it('PUT /settings/lead-time updates the lead time', async () => {
		const original = (await app.inject(withAuth('GET', '/settings'))).json()
			.data.leadTimeDays;

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
