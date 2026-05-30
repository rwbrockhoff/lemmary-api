import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../../utils/api-responses.js';
import { AppError } from '../../utils/app-error.js';
import { syncProducts, getProducts, getProduct } from './products-service.js';

export async function handleSyncProducts(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const result = await syncProducts(request.userId);
	if (!result) throw AppError.badRequest('Connect a store before syncing');
	return successResponse(reply, result, `Synced ${result.synced} products`);
}

export async function handleGetProducts(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const products = await getProducts(request.userId);
	return successResponse(reply, products);
}

export async function handleGetProduct(
	request: FastifyRequest<{ Params: { productId: string } }>,
	reply: FastifyReply,
) {
	const product = await getProduct(request.userId, request.params.productId);
	if (!product) throw AppError.notFound('Product not found');
	return successResponse(reply, product);
}
