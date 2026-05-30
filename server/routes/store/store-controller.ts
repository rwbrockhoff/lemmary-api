import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../../utils/api-responses.js';
import { AppError } from '../../utils/app-error.js';
import type { UpdateStoreRequest } from './contract/types.js';
import { updateStore } from './store-service.js';

export async function handleUpdateStore(
	request: FastifyRequest<{ Body: UpdateStoreRequest }>,
	reply: FastifyReply,
) {
	const result = await updateStore(request.userId, request.body);

	if (!result.ok) {
		if (result.error === 'no_store') throw AppError.notFound('Store not found');
		throw AppError.badRequest(
			'Unable to connect to the store with the provided access token',
		);
	}

	return successResponse(reply, {
		storeName: result.storeName,
		platform: result.platform,
		leadTimeDays: result.leadTimeDays,
	});
}
