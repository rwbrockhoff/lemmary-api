import type { FastifyInstance, InjectOptions } from 'fastify';
import { buildApp } from '../app.js';
import { TEST_AUTH_HEADER } from '../config/constants.js';
import { TEST_USER_ID } from './test-constants.js';

export const buildTestApp = (): FastifyInstance => buildApp();

type RequestOptions = {
	userId?: string;
	headers?: Record<string, string>;
	payload?: InjectOptions['payload'];
	query?: Record<string, string>;
};

export const withAuth = (
	method: InjectOptions['method'],
	url: string,
	options: RequestOptions = {},
): InjectOptions => ({
	method,
	url,
	headers: {
		[TEST_AUTH_HEADER]: options.userId ?? TEST_USER_ID,
		...options.headers,
	},
	...(options.payload !== undefined ? { payload: options.payload } : {}),
	...(options.query ? { query: options.query } : {}),
});
