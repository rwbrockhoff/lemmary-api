import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../openapi/tags.js';
import { successSchema } from '../../openapi/schemas.js';
import { SearchQuerySchema, SearchResponseSchema } from './contract/schemas.js';
import { handleSearch } from './search-controller.js';

export async function searchRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.get(
		'/search',
		{
			schema: {
				tags: [ApiTags.SEARCH],
				summary: 'Search orders, products, and customers',
				querystring: SearchQuerySchema,
				response: { 200: successSchema(SearchResponseSchema) },
			},
		},
		handleSearch,
	);
}
