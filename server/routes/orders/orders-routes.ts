import type { FastifyInstance } from 'fastify';
import {
	handleSyncOrders,
	handleGetOrders,
	handleGetOrder,
	handleGetWorkflowStages,
	handleUpdateOrderStage,
	handleUpdateOrderNotes,
	handleUpdateOrderItemStage,
} from './orders-controller.js';

export async function ordersRoutes(app: FastifyInstance) {
	app.post('/orders/sync', handleSyncOrders);
	app.get('/orders', handleGetOrders);
	app.get('/orders/workflow-stages', handleGetWorkflowStages);
	app.get('/orders/:orderId', handleGetOrder);
	app.put('/orders/:orderId/stage', handleUpdateOrderStage);
	app.put('/orders/:orderId/notes', handleUpdateOrderNotes);
	app.put('/orders/:orderId/items/:itemId/stage', handleUpdateOrderItemStage);
}
