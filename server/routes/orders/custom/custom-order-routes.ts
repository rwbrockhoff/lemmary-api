import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../../openapi/tags.js';
import { successSchema } from '../../../openapi/schemas.js';
import {
	OrderIdParamSchema,
	OrderDetailSchema,
	CreateCustomOrderSchema,
	UpdateCustomOrderSchema,
} from '../contract/schemas.js';
import {
	handleCreateCustomOrder,
	handleUpdateCustomOrder,
} from './custom-order-controller.js';

export async function customOrderRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.post(
		'/orders/custom',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Create a custom order',
				body: CreateCustomOrderSchema,
				response: {
					201: successSchema(OrderDetailSchema),
				},
			},
		},
		handleCreateCustomOrder,
	);

	r.patch(
		'/orders/custom/:orderId',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Update a custom order',
				params: OrderIdParamSchema,
				body: UpdateCustomOrderSchema,
				response: {
					200: successSchema(OrderDetailSchema),
				},
			},
		},
		handleUpdateCustomOrder,
	);
}
