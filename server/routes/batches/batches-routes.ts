import type { FastifyInstance } from 'fastify';
import {
	handleGetBatches,
	handleGetBatch,
	handleCreateBatch,
	handleUpdateBatch,
	handleToggleOrderComplete,
	handleToggleItemComplete,
	handleToggleMaterialComplete,
	handleUpdateOrderItemCompletedQty,
	handleUpdateMaterialCompletedQty,
} from './batches-controller.js';

export async function batchesRoutes(app: FastifyInstance) {
	app.get('/batches', handleGetBatches);
	app.get('/batches/:batchId', handleGetBatch);
	app.post('/batches', handleCreateBatch);
	app.put('/batches/:batchId', handleUpdateBatch);
	app.put('/batches/:batchId/orders/:id', handleToggleOrderComplete);
	app.put('/batches/:batchId/items/:id', handleToggleItemComplete);
	app.put('/batches/:batchId/materials/:id', handleToggleMaterialComplete);
	app.put('/batches/:batchId/order-items/:id/qty', handleUpdateOrderItemCompletedQty);
	app.put('/batches/:batchId/materials/:id/qty', handleUpdateMaterialCompletedQty);
}
