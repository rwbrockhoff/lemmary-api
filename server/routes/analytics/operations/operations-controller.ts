import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	badRequest,
	internalError,
} from '../../../utils/api-responses.js';
import {
	getOperations,
	VALID_RANGES,
	type OperationsRange,
} from './operations-service.js';

export async function handleGetOperations(
	request: FastifyRequest<{ Querystring: { range?: string } }>,
	reply: FastifyReply,
) {
	try {
		const rangeParam = request.query.range ?? '30';
		const range = Number(rangeParam) as OperationsRange;

		if (!VALID_RANGES.includes(range)) {
			return badRequest(reply, 'range must be 30, 90, or 365');
		}

		const data = await getOperations(request.userId, range);
		return successResponse(reply, data);
	} catch (error) {
		request.log.error(error, 'Failed to fetch operations analytics');
		return internalError(reply);
	}
}
