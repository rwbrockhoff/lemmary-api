import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	badRequest,
	internalError,
} from '../../../utils/api-responses.js';
import { PerformanceQuerySchema } from './contract/schemas.js';
import { getPerformance } from './performance-service.js';

export async function handleGetPerformance(
	request: FastifyRequest<{ Querystring: { range?: string } }>,
	reply: FastifyReply,
) {
	const parseResult = PerformanceQuerySchema.safeParse(request.query);
	if (!parseResult.success) {
		return badRequest(reply, 'Invalid request', parseResult.error.format());
	}

	try {
		const data = await getPerformance(request.userId, parseResult.data);
		return successResponse(reply, data);
	} catch (error) {
		request.log.error(error, 'Failed to fetch performance analytics');
		return internalError(reply);
	}
}
