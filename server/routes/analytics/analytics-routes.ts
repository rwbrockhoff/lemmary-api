import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../openapi/tags.js';
import { successSchema } from '../../openapi/schemas.js';
import {
	OperationsQuerySchema,
	OperationsResponseSchema,
} from './operations/contract/schemas.js';
import {
	PerformanceQuerySchema,
	PerformanceResponseSchema,
} from './performance/contract/schemas.js';
import { handleGetOperations } from './operations/operations-controller.js';
import { handleGetPerformance } from './performance/performance-controller.js';

export async function analyticsRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.get(
		'/analytics/operations',
		{
			schema: {
				tags: [ApiTags.ANALYTICS],
				summary: 'Operations dashboard — revenue, lead time, due soon, trend',
				querystring: OperationsQuerySchema,
				response: {
					200: successSchema(OperationsResponseSchema),
				},
			},
		},
		handleGetOperations,
	);

	r.get(
		'/analytics/performance',
		{
			schema: {
				tags: [ApiTags.ANALYTICS],
				summary:
					'Performance dashboard — bottlenecks, top products, customer mix, coupons, materials',
				querystring: PerformanceQuerySchema,
				response: {
					200: successSchema(PerformanceResponseSchema),
				},
			},
		},
		handleGetPerformance,
	);
}
