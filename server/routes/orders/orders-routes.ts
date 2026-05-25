import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../openapi/tags.js';
import { successSchema } from '../../openapi/schemas.js';
import {
	GetOrdersQuerySchema,
	GetOrdersResponseSchema,
} from './contract/schemas.js';
import {
	handleSyncOrders,
	handleGetOrders,
	handleGetOrder,
	handleUpdateOrderStage,
	handleUpdateOrderNotes,
	handleUpdateOrderItemStage,
	handleGetWorkflowBoard,
	handleCompleteAllOrderItems,
} from './orders-controller.js';

export async function ordersRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	app.post('/orders/sync', handleSyncOrders);

	r.get(
		'/orders',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'List orders by status',
				querystring: GetOrdersQuerySchema,
				response: {
					200: successSchema(GetOrdersResponseSchema),
				},
			},
		},
		handleGetOrders,
	);

	app.get('/orders/workflow-board', handleGetWorkflowBoard);
	app.get('/orders/:orderId', handleGetOrder);
	app.put('/orders/:orderId/stage', handleUpdateOrderStage);
	app.put('/orders/:orderId/notes', handleUpdateOrderNotes);
	app.put('/orders/:orderId/items/completion', handleCompleteAllOrderItems);
	app.put('/orders/:orderId/items/:itemId/stage', handleUpdateOrderItemStage);
}
