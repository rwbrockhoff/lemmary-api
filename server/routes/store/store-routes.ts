import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../openapi/tags.js';
import { successSchema } from '../../openapi/schemas.js';
import {
	UpdateStoreRequestSchema,
	UpdateStoreResponseSchema,
	CreateStoreRequestSchema,
	StoreResponseSchema,
} from './contract/schemas.js';
import {
	handleGetStore,
	handleCreateStore,
	handleUpdateStore,
} from './store-controller.js';

export async function storeRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.get(
		'/store',
		{
			schema: {
				tags: [ApiTags.STORE],
				summary: 'Get the store and its connection status',
				response: {
					200: successSchema(StoreResponseSchema),
				},
			},
		},
		handleGetStore,
	);

	r.post(
		'/store',
		{
			schema: {
				tags: [ApiTags.STORE],
				summary: 'Create the store during onboarding',
				body: CreateStoreRequestSchema,
				response: {
					201: successSchema(StoreResponseSchema),
				},
			},
		},
		handleCreateStore,
	);

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
