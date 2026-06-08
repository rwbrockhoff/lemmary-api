import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../openapi/tags.js';
import { successSchema } from '../../openapi/schemas.js';
import {
	GetOrdersQuerySchema,
	GetOrdersResponseSchema,
	OrderSchema,
	OrderItemSchema,
	OrderDetailSchema,
	WorkflowBoardResponseSchema,
	StageOrdersParamSchema,
	StageOrdersQuerySchema,
	StageOrdersResponseSchema,
	SyncOrdersResponseSchema,
	CompleteItemsResponseSchema,
	OrderIdParamSchema,
	OrderItemParamsSchema,
	UpdateOrderStageBodySchema,
	UpdateOrderNotesBodySchema,
	DeleteOrderResponseSchema,
} from './contract/schemas.js';
import {
	handleSyncOrders,
	handleGetOrders,
	handleDeleteOrder,
	handleGetOrder,
	handleUpdateOrderStage,
	handleUpdateOrderNotes,
	handleUpdateOrderItemStage,
	handleGetWorkflowBoard,
	handleGetStageOrders,
	handleCompleteAllOrderItems,
} from './orders-controller.js';
import { customOrderRoutes } from './custom/custom-order-routes.js';
import { workOrderRoutes } from './work-order/work-order-routes.js';

export async function ordersRoutes(app: FastifyInstance) {
	await app.register(customOrderRoutes);
	await app.register(workOrderRoutes);

	const r = app.withTypeProvider<ZodTypeProvider>();

	r.post(
		'/orders/sync',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Sync orders from the connected platform',
				response: {
					200: successSchema(SyncOrdersResponseSchema),
				},
			},
		},
		handleSyncOrders,
	);

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

	r.get(
		'/orders/workflow-board',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Get the workflow board view',
				response: {
					200: successSchema(WorkflowBoardResponseSchema),
				},
			},
		},
		handleGetWorkflowBoard,
	);

	r.get(
		'/orders/workflow-board/stages/:stageId/orders',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Get paginated orders for a single workflow stage',
				params: StageOrdersParamSchema,
				querystring: StageOrdersQuerySchema,
				response: {
					200: successSchema(StageOrdersResponseSchema),
				},
			},
		},
		handleGetStageOrders,
	);

	r.get(
		'/orders/:orderId',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Get an order with its items',
				params: OrderIdParamSchema,
				response: {
					200: successSchema(OrderDetailSchema),
				},
			},
		},
		handleGetOrder,
	);

	r.delete(
		'/orders/:orderId',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Delete a custom or work order',
				params: OrderIdParamSchema,
				response: {
					200: successSchema(DeleteOrderResponseSchema),
				},
			},
		},
		handleDeleteOrder,
	);

	r.put(
		'/orders/:orderId/stage',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Update order workflow stage',
				params: OrderIdParamSchema,
				body: UpdateOrderStageBodySchema,
				response: {
					200: successSchema(OrderSchema),
				},
			},
		},
		handleUpdateOrderStage,
	);

	r.put(
		'/orders/:orderId/notes',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Update order notes',
				params: OrderIdParamSchema,
				body: UpdateOrderNotesBodySchema,
				response: {
					200: successSchema(OrderSchema),
				},
			},
		},
		handleUpdateOrderNotes,
	);

	r.put(
		'/orders/:orderId/items/completion',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Mark all order items complete',
				params: OrderIdParamSchema,
				response: {
					200: successSchema(CompleteItemsResponseSchema),
				},
			},
		},
		handleCompleteAllOrderItems,
	);

	r.put(
		'/orders/:orderId/items/:itemId/stage',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Update order item workflow stage',
				params: OrderItemParamsSchema,
				body: UpdateOrderStageBodySchema,
				response: {
					200: successSchema(OrderItemSchema),
				},
			},
		},
		handleUpdateOrderItemStage,
	);
}
