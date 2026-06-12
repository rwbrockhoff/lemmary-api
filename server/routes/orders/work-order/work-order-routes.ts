import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../../openapi/tags.js';
import { successSchema } from '../../../openapi/schemas.js';
import {
	OrderIdParamSchema,
	OrderDetailSchema,
	CreateWorkOrderSchema,
	UpdateWorkOrderSchema,
} from '../contract/schemas.js';
import {
	handleCreateWorkOrder,
	handleUpdateWorkOrder,
} from './work-order-controller.js';

export async function workOrderRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.post(
		'/orders/work',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Create a work order',
				body: CreateWorkOrderSchema,
				response: {
					201: successSchema(OrderDetailSchema),
				},
			},
		},
		handleCreateWorkOrder,
	);

	r.patch(
		'/orders/work/:orderId',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Update a work order',
				params: OrderIdParamSchema,
				body: UpdateWorkOrderSchema,
				response: {
					200: successSchema(OrderDetailSchema),
				},
			},
		},
		handleUpdateWorkOrder,
	);
}
