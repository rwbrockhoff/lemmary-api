import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../../../utils/api-responses.js';
import { getOperations, type OperationsRange } from './operations-service.js';

export async function handleGetOperations(
	request: FastifyRequest<{ Querystring: { range: '30' | '90' | '365' } }>,
	reply: FastifyReply,
) {
	const range = Number(request.query.range) as OperationsRange;
	const data = await getOperations(request.userId, range);
	return successResponse(reply, data);
}
