import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse, internalError } from '../../utils/api-responses.js';
import { syncProducts, getProducts } from './products-service.js';

export async function handleSyncProducts(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	try {
		const result = await syncProducts(request.userId);
		return successResponse(reply, result, `Synced ${result.synced} products`);
	} catch (error) {
		request.log.error(error, 'Failed to sync products');
		return internalError(reply, 'Failed to sync products from platform');
	}
}

export async function handleGetProducts(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	try {
		const products = await getProducts(request.userId);
		return successResponse(reply, products);
	} catch (error) {
		request.log.error(error, 'Failed to fetch products');
		return internalError(reply);
	}
}
