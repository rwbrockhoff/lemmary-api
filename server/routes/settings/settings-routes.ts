import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../openapi/tags.js';
import { successSchema } from '../../openapi/schemas.js';
import {
	StoreSettingsResponseSchema,
	UpdateLeadTimeRequestSchema,
	UpdateLeadTimeResponseSchema,
} from './contract/schemas.js';
import {
	handleGetSettings,
	handleUpdateLeadTime,
} from './settings-controller.js';

export async function settingsRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.get(
		'/settings',
		{
			schema: {
				tags: [ApiTags.SETTINGS],
				summary: 'Get account and store settings',
				response: {
					200: successSchema(StoreSettingsResponseSchema),
				},
			},
		},
		handleGetSettings,
	);

	r.put(
		'/settings/lead-time',
		{
			schema: {
				tags: [ApiTags.SETTINGS],
				summary: 'Update store lead time',
				body: UpdateLeadTimeRequestSchema,
				response: {
					200: successSchema(UpdateLeadTimeResponseSchema),
				},
			},
		},
		handleUpdateLeadTime,
	);
}
