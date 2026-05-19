import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from './test-helpers.js';

type ProtectedRoute = [method: 'GET' | 'PATCH', url: string];

const PROTECTED_ROUTES: ProtectedRoute[] = [
	['GET', '/analytics/performance'],
	['GET', '/analytics/operations'],
	['GET', '/orders'],
	['GET', '/batches'],
	['GET', '/workflow-stages'],
	['GET', '/reports/production-summary'],
	['GET', '/reports/materials'],
	['GET', '/settings'],
	['GET', '/bom/material-types'],
	['GET', '/products'],
	['PATCH', '/store'],
];

describe('Auth guard', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it.each(PROTECTED_ROUTES)(
		'%s %s returns 401 without a session',
		async (method, url) => {
			const response = await app.inject({ method, url });
			expect(response.statusCode).toBe(401);
		},
	);
});
