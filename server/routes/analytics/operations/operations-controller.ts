import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../../../utils/api-responses.js';
import { getOperations } from './operations-service.js';

export async function handleGetOperations(
	request: FastifyRequest<{ Querystring: { start: string; end: string } }>,
	reply: FastifyReply,
) {
	const { start, end } = request.query;
	const data = await getOperations(request.userId, start, end);
	return successResponse(reply, data);
}
