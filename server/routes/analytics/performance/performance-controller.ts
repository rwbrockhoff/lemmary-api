import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../../../utils/api-responses.js';
import { getPerformance } from './performance-service.js';

export async function handleGetPerformance(
	request: FastifyRequest<{ Querystring: { range: '30' | '90' | '365' } }>,
	reply: FastifyReply,
) {
	const data = await getPerformance(request.userId, request.query);
	return successResponse(reply, data);
}
