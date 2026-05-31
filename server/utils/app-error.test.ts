import { describe, it, expect } from 'vitest';
import { AppError } from './app-error.js';
import { ErrorCode } from './api-responses.js';

describe('AppError', () => {
	it('defaults to 500 / INTERNAL_ERROR when no status or code is given', () => {
		const err = new AppError('Boom');
		expect(err.message).toBe('Boom');
		expect(err.statusCode).toBe(500);
		expect(err.code).toBe(ErrorCode.INTERNAL_ERROR);
		expect(err).toBeInstanceOf(Error);
	});

	it('badRequest factory builds a 400 with VALIDATION_ERROR', () => {
		const err = AppError.badRequest('Missing field');
		expect(err.statusCode).toBe(400);
		expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
		expect(err.message).toBe('Missing field');
	});

	it('unauthorized factory builds a 401', () => {
		const err = AppError.unauthorized();
		expect(err.statusCode).toBe(401);
		expect(err.code).toBe(ErrorCode.AUTHENTICATION_ERROR);
	});

	it('forbidden factory builds a 403', () => {
		const err = AppError.forbidden();
		expect(err.statusCode).toBe(403);
		expect(err.code).toBe(ErrorCode.AUTHORIZATION_ERROR);
	});

	it('notFound factory builds a 404', () => {
		const err = AppError.notFound('Order not found');
		expect(err.statusCode).toBe(404);
		expect(err.code).toBe(ErrorCode.NOT_FOUND);
		expect(err.message).toBe('Order not found');
	});

	it('conflict factory builds a 409 and carries details', () => {
		const err = AppError.conflict('Email exists', { field: 'email' });
		expect(err.statusCode).toBe(409);
		expect(err.code).toBe(ErrorCode.CONFLICT);
		expect(err.details).toEqual({ field: 'email' });
	});
});
