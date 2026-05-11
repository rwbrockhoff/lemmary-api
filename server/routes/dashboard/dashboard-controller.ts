import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse, internalError } from '../../utils/api-responses.js';
import { getDashboard } from './dashboard-service.js';

export async function handleGetDashboard(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	try {
		const data = await getDashboard(request.userId);
		return successResponse(reply, data);
	} catch (error) {
		request.log.error(error, 'Failed to fetch dashboard');
		return internalError(reply);
	}
}
