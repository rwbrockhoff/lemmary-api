import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../../utils/api-responses.js';
import { AppError } from '../../utils/app-error.js';
import type { ProductionType } from '../../db/enums.js';
import {
	syncProducts,
	getProducts,
	getProduct,
	updateVariantProductionType,
	updateProductProductionType,
	updateAllProductionTypes,
} from './products-service.js';

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

export async function handleUpdateVariantProductionType(
	request: FastifyRequest<{
		Params: { productId: string; variantId: string };
		Body: { productionType: ProductionType };
	}>,
	reply: FastifyReply,
) {
	const { productId, variantId } = request.params;
	const updated = await updateVariantProductionType(
		request.userId,
		productId,
		variantId,
		request.body.productionType,
	);
	if (!updated) throw AppError.notFound('Variant not found');
	return successResponse(reply, updated);
}

export async function handleUpdateProductProductionType(
	request: FastifyRequest<{
		Params: { productId: string };
		Body: { productionType: ProductionType };
	}>,
	reply: FastifyReply,
) {
	const updated = await updateProductProductionType(
		request.userId,
		request.params.productId,
		request.body.productionType,
	);
	if (updated === null) throw AppError.notFound('Product not found');
	return successResponse(reply, { updated });
}

export async function handleUpdateAllProductionTypes(
	request: FastifyRequest<{ Body: { productionType: ProductionType } }>,
	reply: FastifyReply,
) {
	const updated = await updateAllProductionTypes(
		request.userId,
		request.body.productionType,
	);
	if (updated === null) throw AppError.badRequest('Connect a store first.');
	return successResponse(reply, { updated });
}
