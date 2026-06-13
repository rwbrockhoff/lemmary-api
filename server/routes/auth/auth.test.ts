import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';
import { NON_APP_USER_ID } from '../../tests/test-constants.js';

describe('Auth API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('POST /auth/demo returns a demo session and sets a refresh cookie', async () => {
		const response = await app.inject({
			method: 'POST',
			url: '/auth/demo',
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.data.isDemo).toBe(true);
		expect(body.data.userId).toBeTruthy();
		expect(response.cookies.some((c) => c.name === 'refresh-token')).toBe(true);
	});

	it('POST /auth/logout clears the refresh cookie', async () => {
		const response = await app.inject({
			method: 'POST',
			url: '/auth/logout',
		});

		expect(response.statusCode).toBe(200);
		const cleared = response.cookies.find((c) => c.name === 'refresh-token');
		expect(cleared?.value).toBe('');
	});

	it('GET /auth/status returns unauthenticated without a session', async () => {
		const response = await app.inject({
			method: 'GET',
			url: '/auth/status',
		});

		expect(response.statusCode).toBe(200);
		expect(response.json().data.isAuthenticated).toBe(false);
	});

	it('GET /auth/status returns authenticated for a valid session', async () => {
		const response = await app.inject(withAuth('GET', '/auth/status'));

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.data.isAuthenticated).toBe(true);
		expect(body.data.user).toBeTruthy();
	});

	it('GET /auth/identity requires a session', async () => {
		const response = await app.inject({
			method: 'GET',
			url: '/auth/identity',
		});

		expect(response.statusCode).toBe(401);
	});

	it('PUT /auth/password requires a session', async () => {
		const response = await app.inject({
			method: 'PUT',
			url: '/auth/password',
			payload: { currentPassword: 'currentpass', newPassword: 'newpassword1' },
		});

		expect(response.statusCode).toBe(401);
	});

	it('PUT /auth/password returns 401 when the account is missing', async () => {
		const response = await app.inject(
			withAuth('PUT', '/auth/password', {
				userId: NON_APP_USER_ID,
				payload: {
					currentPassword: 'currentpass',
					newPassword: 'newpassword1',
				},
			}),
		);

		expect(response.statusCode).toBe(401);
	});

	it('PUT /auth/email returns 401 when the account is missing', async () => {
		const response = await app.inject(
			withAuth('PUT', '/auth/email', {
				userId: NON_APP_USER_ID,
				payload: {
					currentPassword: 'currentpass',
					newEmail: 'new@example.com',
				},
			}),
		);

		expect(response.statusCode).toBe(401);
	});
});
