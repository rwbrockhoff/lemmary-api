import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../openapi/tags.js';
import { successSchema } from '../../openapi/schemas.js';
import {
	CreateBatchRequestSchema,
	UpdateBatchRequestSchema,
	ToggleCompleteBodySchema,
	UpdateCompletedQtyBodySchema,
	BatchIdParamSchema,
	BatchSubResourceParamsSchema,
	BatchSchema,
	BatchOrderSchema,
	BatchItemSchema,
	BatchOrderItemSchema,
	BatchMaterialSchema,
	GetBatchesResponseSchema,
	GetBatchResponseSchema,
} from './contract/schemas.js';
import {
	handleGetBatches,
	handleGetBatch,
	handleCreateBatch,
	handleUpdateBatch,
	handleDeleteBatch,
	handleToggleOrderComplete,
	handleToggleItemComplete,
	handleToggleMaterialComplete,
	handleUpdateOrderItemCompletedQty,
	handleUpdateMaterialCompletedQty,
} from './batches-controller.js';

export async function batchesRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.get(
		'/batches',
		{
			schema: {
				tags: [ApiTags.BATCHES],
				summary: 'List production batches',
				response: {
					200: successSchema(GetBatchesResponseSchema),
				},
			},
		},
		handleGetBatches,
	);

	r.get(
		'/batches/:batchId',
		{
			schema: {
				tags: [ApiTags.BATCHES],
				summary: 'Get a batch with orders, items, and materials',
				params: BatchIdParamSchema,
				response: {
					200: successSchema(GetBatchResponseSchema),
				},
			},
		},
		handleGetBatch,
	);

	r.post(
		'/batches',
		{
			schema: {
				tags: [ApiTags.BATCHES],
				summary: 'Create a production batch from orders',
				body: CreateBatchRequestSchema,
				response: {
					201: successSchema(BatchSchema),
				},
			},
		},
		handleCreateBatch,
	);

	r.put(
		'/batches/:batchId',
		{
			schema: {
				tags: [ApiTags.BATCHES],
				summary: 'Update a batch (status, name, or orders)',
				params: BatchIdParamSchema,
				body: UpdateBatchRequestSchema,
				response: {
					200: successSchema(BatchSchema),
				},
			},
		},
		handleUpdateBatch,
	);

	r.delete(
		'/batches/:batchId',
		{
			schema: {
				tags: [ApiTags.BATCHES],
				summary: 'Delete a batch',
				params: BatchIdParamSchema,
				response: {
					200: successSchema(BatchSchema),
				},
			},
		},
		handleDeleteBatch,
	);

	r.put(
		'/batches/:batchId/orders/:id',
		{
			schema: {
				tags: [ApiTags.BATCHES],
				summary: 'Toggle a batch order complete',
				params: BatchSubResourceParamsSchema,
				body: ToggleCompleteBodySchema,
				response: {
					200: successSchema(BatchOrderSchema),
				},
			},
		},
		handleToggleOrderComplete,
	);

	r.put(
		'/batches/:batchId/items/:id',
		{
			schema: {
				tags: [ApiTags.BATCHES],
				summary: 'Toggle a batch item complete',
				params: BatchSubResourceParamsSchema,
				body: ToggleCompleteBodySchema,
				response: {
					200: successSchema(BatchItemSchema),
				},
			},
		},
		handleToggleItemComplete,
	);

	r.put(
		'/batches/:batchId/materials/:id',
		{
			schema: {
				tags: [ApiTags.BATCHES],
				summary: 'Toggle a batch material complete',
				params: BatchSubResourceParamsSchema,
				body: ToggleCompleteBodySchema,
				response: {
					200: successSchema(BatchMaterialSchema),
				},
			},
		},
		handleToggleMaterialComplete,
	);

	r.put(
		'/batches/:batchId/order-items/:id/qty',
		{
			schema: {
				tags: [ApiTags.BATCHES],
				summary: 'Update a batch order item completed quantity',
				params: BatchSubResourceParamsSchema,
				body: UpdateCompletedQtyBodySchema,
				response: {
					200: successSchema(BatchOrderItemSchema),
				},
			},
		},
		handleUpdateOrderItemCompletedQty,
	);

	r.put(
		'/batches/:batchId/materials/:id/qty',
		{
			schema: {
				tags: [ApiTags.BATCHES],
				summary: 'Update a batch material completed quantity',
				params: BatchSubResourceParamsSchema,
				body: UpdateCompletedQtyBodySchema,
				response: {
					200: successSchema(BatchMaterialSchema),
				},
			},
		},
		handleUpdateMaterialCompletedQty,
	);
}
