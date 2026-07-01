import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../../openapi/tags.js';
import { OrderIdParamSchema } from '../contract/schemas.js';
import { PackingSlipsBodySchema } from './contract/schemas.js';
import {
	handleGetPackingSlip,
	handleGetPackingSlips,
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

	r.post(
		'/orders/packing-slips',
		{
			schema: {
				tags: [ApiTags.ORDERS],
				summary: 'Download a combined packing slip PDF for multiple orders',
				body: PackingSlipsBodySchema,
			},
		},
		handleGetPackingSlips,
	);
}
