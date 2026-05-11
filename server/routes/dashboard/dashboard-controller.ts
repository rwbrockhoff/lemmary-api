import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	badRequest,
	internalError,
} from '../../utils/api-responses.js';
import {
	getDashboard,
	VALID_RANGES,
	type DashboardRange,
} from './dashboard-service.js';

export async function handleGetDashboard(
	request: FastifyRequest<{ Querystring: { range?: string } }>,
	reply: FastifyReply,
) {
	try {
		const rangeParam = request.query.range ?? '30';
		const range = Number(rangeParam) as DashboardRange;

		if (!VALID_RANGES.includes(range)) {
			return badRequest(reply, 'range must be 30, 90, or 365');
		}

		const data = await getDashboard(request.userId, range);
		return successResponse(reply, data);
	} catch (error) {
		request.log.error(error, 'Failed to fetch dashboard');
		return internalError(reply);
	}
}
