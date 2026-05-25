import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../openapi/tags.js';
import { successSchema } from '../../openapi/schemas.js';
import {
	UpdateStoreRequestSchema,
	UpdateStoreResponseSchema,
} from './contract/schemas.js';
import { handleUpdateStore } from './store-controller.js';

export async function storeRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.patch(
		'/store',
		{
			schema: {
				tags: [ApiTags.STORE],
				summary: 'Update store settings',
				body: UpdateStoreRequestSchema,
				response: {
					200: successSchema(UpdateStoreResponseSchema),
				},
			},
		},
		handleUpdateStore,
	);
}
