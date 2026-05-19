import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';

describe('Store API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('PATCH /store updates the store name', async () => {
		const response = await app.inject(
			withAuth('PATCH', '/store', {
				payload: { storeName: 'Updated Test Store' },
			}),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data.storeName).toBe('Updated Test Store');
	});
});
