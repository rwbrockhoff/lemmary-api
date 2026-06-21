import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse, createdSuccess } from '../../utils/api-responses.js';
import { AppError } from '../../utils/app-error.js';
import type {
	UpdateStoreRequest,
	CreateStoreRequest,
} from './contract/types.js';
import {
	getStore,
	createStore,
	updateStore,
	deleteStore,
} from './store-service.js';

export async function handleGetStore(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const store = await getStore(request.userId);
	return successResponse(reply, store);
}

export async function handleCreateStore(
	request: FastifyRequest<{ Body: CreateStoreRequest }>,
	reply: FastifyReply,
) {
	const result = await createStore(request.userId, request.body);

	if (!result.ok) {
		if (result.error === 'store_exists')
			throw AppError.conflict('A store is already connected.');
		throw AppError.badRequest(
			'Unable to connect to the store with the provided access token',
		);
	}

	return createdSuccess(reply, result.store);
}

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

export async function handleDeleteStore(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const result = await deleteStore(request.userId);

	if (!result.ok) throw AppError.notFound('Store not found');

	return successResponse(reply);
}
