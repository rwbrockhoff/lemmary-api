import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse, internalError } from '../../../utils/api-responses.js';
import { getPerformance } from './performance-service.js';

export async function handleGetPerformance(
	request: FastifyRequest<{ Querystring: { range: '30' | '90' | '365' } }>,
	reply: FastifyReply,
) {
	try {
		const data = await getPerformance(request.userId, request.query);
		return successResponse(reply, data);
	} catch (error) {
		request.log.error(error, 'Failed to fetch performance analytics');
		return internalError(reply);
	}
}
