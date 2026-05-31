import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../openapi/tags.js';
import { successSchema } from '../../openapi/schemas.js';
import {
	CustomerDetailSchema,
	CustomerEmailParamSchema,
} from './contract/schemas.js';
import { handleGetCustomer } from './customers-controller.js';

export async function customersRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.get(
		'/customers/:email',
		{
			schema: {
				tags: [ApiTags.CUSTOMERS],
				summary: 'Get a customer with their order history and loyalty tier',
				params: CustomerEmailParamSchema,
				response: {
					200: successSchema(CustomerDetailSchema),
				},
			},
		},
		handleGetCustomer,
	);
}
