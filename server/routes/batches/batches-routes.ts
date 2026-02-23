import type { FastifyInstance } from 'fastify';
import {
	handleGetBatches,
	handleGetBatch,
	handleCreateBatch,
	handleUpdateBatch,
} from './batches-controller.js';

export async function batchesRoutes(app: FastifyInstance) {
	app.get('/batches', handleGetBatches);
	app.get('/batches/:batchId', handleGetBatch);
	app.post('/batches', handleCreateBatch);
	app.patch('/batches/:batchId', handleUpdateBatch);
}
