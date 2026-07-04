import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../../openapi/tags.js';
import { OrderIdParamSchema } from '../contract/schemas.js';
import { BatchIdParamSchema } from './contract/schemas.js';
import {
	handleGetPackingSlip,
	handleGetBatchPackingSlips,
} from './packing-slip-controller.js';

export async function packingSlipRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.get(
		'/orders/:orderId/packing-slip',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Download a packing slip PDF for one order',
				params: OrderIdParamSchema,
			},
		},
		handleGetPackingSlip,
	);

	r.get(
		'/batches/:batchId/packing-slips',
		{
			schema: {
				tags: [ApiTags.BATCHES],
				summary: 'Download a combined packing slip PDF for a batch',
				params: BatchIdParamSchema,
			},
		},
		handleGetBatchPackingSlips,
	);
}
