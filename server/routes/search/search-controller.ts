import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../../utils/api-responses.js';
import { search } from './search-service.js';
import type { SearchQuery } from './contract/types.js';

export async function handleSearch(
	request: FastifyRequest<{ Querystring: SearchQuery }>,
	reply: FastifyReply,
) {
	const results = await search(request.userId, request.query.q);
	return successResponse(reply, results);
}
