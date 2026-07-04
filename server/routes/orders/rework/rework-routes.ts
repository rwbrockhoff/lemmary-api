import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../../openapi/tags.js';
import { successSchema } from '../../../openapi/schemas.js';
import {
	OrderIdParamSchema,
	OrderDetailSchema,
	CreateReworkSchema,
} from '../contract/schemas.js';
import { handleCreateRework } from './rework-controller.js';

export async function reworkRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.post(
		'/orders/:orderId/rework',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Create a rework of an order',
				params: OrderIdParamSchema,
				body: CreateReworkSchema,
				response: {
					201: successSchema(OrderDetailSchema),
				},
			},
		},
		handleCreateRework,
	);
}
