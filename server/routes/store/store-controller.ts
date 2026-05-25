import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	badRequest,
	notFound,
	internalError,
} from '../../utils/api-responses.js';
import type { UpdateStoreRequest } from './contract/types.js';
import { updateStore } from './store-service.js';

export async function handleUpdateStore(
	request: FastifyRequest<{ Body: UpdateStoreRequest }>,
	reply: FastifyReply,
) {
	try {
		const result = await updateStore(request.userId, request.body);

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
