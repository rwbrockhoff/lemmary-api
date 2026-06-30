import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../../../utils/api-responses.js';
import { getPerformance } from './performance-service.js';

export async function handleGetPerformance(
	request: FastifyRequest<{ Querystring: { start: string; end: string } }>,
	reply: FastifyReply,
) {
	const { start, end } = request.query;
	const data = await getPerformance(request.userId, start, end);
	return successResponse(reply, data);
}
