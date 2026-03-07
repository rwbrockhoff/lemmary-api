import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	notFound,
	internalError,
} from '../../utils/api-responses.js';
import { syncProducts, getProducts, getProduct } from './products-service.js';

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

export async function handleGetProduct(
	request: FastifyRequest<{ Params: { productId: string } }>,
	reply: FastifyReply,
) {
	try {
		const product = await getProduct(
			request.userId,
			request.params.productId,
		);

		if (!product) {
			return notFound(reply, 'Product not found');
		}

		return successResponse(reply, product);
	} catch (error) {
		request.log.error(error, 'Failed to fetch product');
		return internalError(reply);
	}
}
