import type { FastifyInstance } from 'fastify';
import {
	handleGetBatches,
	handleGetBatch,
	handleCreateBatch,
	handleUpdateBatch,
	handleToggleOrderComplete,
	handleToggleItemComplete,
	handleToggleMaterialComplete,
} from './batches-controller.js';

export async function batchesRoutes(app: FastifyInstance) {
	app.get('/batches', handleGetBatches);
	app.get('/batches/:batchId', handleGetBatch);
	app.post('/batches', handleCreateBatch);
	app.patch('/batches/:batchId', handleUpdateBatch);
	app.patch('/batches/:batchId/orders/:id', handleToggleOrderComplete);
	app.patch('/batches/:batchId/items/:id', handleToggleItemComplete);
	app.patch('/batches/:batchId/materials/:id', handleToggleMaterialComplete);
}
