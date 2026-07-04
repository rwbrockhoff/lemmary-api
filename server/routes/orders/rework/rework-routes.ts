import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../../openapi/tags.js';
import { successSchema } from '../../../openapi/schemas.js';
import {
	OrderIdParamSchema,
	OrderDetailSchema,
	CreateReworkSchema,
	UpdateReworkSchema,
} from '../contract/schemas.js';
import { handleCreateRework, handleUpdateRework } from './rework-controller.js';

export async function reworkRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.post(
		'/orders/rework',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Create a rework of an order',
				body: CreateReworkSchema,
				response: {
					201: successSchema(OrderDetailSchema),
				},
			},
		},
		handleCreateRework,
	);

	r.patch(
		'/orders/rework/:orderId',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Update a rework order',
				params: OrderIdParamSchema,
				body: UpdateReworkSchema,
				response: {
					200: successSchema(OrderDetailSchema),
				},
			},
		},
		handleUpdateRework,
	);
}
