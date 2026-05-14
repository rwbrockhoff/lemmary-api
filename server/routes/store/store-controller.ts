import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	badRequest,
	notFound,
	internalError,
} from '../../utils/api-responses.js';
import { UpdateStoreRequestSchema } from './contract/schemas.js';
import { updateStore } from './store-service.js';

export async function handleUpdateStore(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const parseResult = UpdateStoreRequestSchema.safeParse(request.body);
	if (!parseResult.success) {
		return badRequest(reply, 'Invalid request', parseResult.error.format());
	}

	try {
		const result = await updateStore(request.userId, parseResult.data);

		if (!result.ok) {
			if (result.error === 'no_store') {
				return notFound(reply, 'Store not found');
			}
			return badRequest(
				reply,
				'Unable to connect to the store with the provided access token',
			);
		}

		return successResponse(reply, {
			storeName: result.storeName,
			platform: result.platform,
			leadTimeDays: result.leadTimeDays,
		});
	} catch (error) {
		request.log.error(error, 'Failed to update store');
		return internalError(reply);
	}
}
