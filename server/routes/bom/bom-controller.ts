import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	createdSuccess,
} from '../../utils/api-responses.js';
import { AppError } from '../../utils/app-error.js';
import type {
	CreateBomItemRequest,
	UpdateBomItemRequest,
	GetOrCreateMaterialRequest,
	CopyBomRequest,
	BomVariantQuery,
	MaterialTypeSearchQuery,
	MaterialSearchQuery,
	SuggestionsQuery,
} from './contract/types.js';
import {
	getMaterialTypes,
	searchMaterialTypes,
	searchMaterialCatalog,
	searchMaterials,
	getOrCreateMaterial,
	getBomForVariant,
	createBomItem,
	updateBomItem,
	deleteBomItem,
	getBomSuggestions,
	copyBomFromVariant,
} from './bom-service.js';

export async function handleGetMaterialTypes(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const materialTypes = await getMaterialTypes(request.userId);
	return successResponse(reply, materialTypes);
}

export async function handleGetBomForVariant(
	request: FastifyRequest<{ Querystring: BomVariantQuery }>,
	reply: FastifyReply,
) {
	const bom = await getBomForVariant(request.userId, request.query.variantId);
	return successResponse(reply, bom);
}

export async function handleCreateBomItem(
	request: FastifyRequest<{ Body: CreateBomItemRequest }>,
	reply: FastifyReply,
) {
	const item = await createBomItem(request.userId, request.body);
	if (!item) throw AppError.badRequest('Connect a store first');
	return createdSuccess(reply, item, 'BOM item created');
}

export async function handleUpdateBomItem(
	request: FastifyRequest<{
		Params: { bomItemId: string };
		Body: UpdateBomItemRequest;
	}>,
	reply: FastifyReply,
) {
	const item = await updateBomItem(
		request.userId,
		request.params.bomItemId,
		request.body,
	);

	if (!item) throw AppError.notFound('BOM item not found');
	return successResponse(reply, item, 'BOM item updated');
}

export async function handleDeleteBomItem(
	request: FastifyRequest<{ Params: { bomItemId: string } }>,
	reply: FastifyReply,
) {
	const deleted = await deleteBomItem(
		request.userId,
		request.params.bomItemId,
	);

	if (!deleted) throw AppError.notFound('BOM item not found');
	return successResponse(reply, null, 'BOM item deleted');
}

export async function handleSearchMaterialTypes(
	request: FastifyRequest<{ Querystring: MaterialTypeSearchQuery }>,
	reply: FastifyReply,
) {
	const query = request.query.q ?? '';
	if (query.length < 1) return successResponse(reply, []);

	const results = await searchMaterialTypes(
		request.userId,
		query,
		request.query.measurement,
	);
	return successResponse(reply, results);
}

export async function handleSearchMaterialCatalog(
	request: FastifyRequest<{ Querystring: MaterialTypeSearchQuery }>,
	reply: FastifyReply,
) {
	const query = request.query.q ?? '';
	if (query.length < 1) return successResponse(reply, []);

	const results = await searchMaterialCatalog(
		request.userId,
		query,
		request.query.measurement,
	);
	return successResponse(reply, results);
}

export async function handleSearchMaterials(
	request: FastifyRequest<{ Querystring: MaterialSearchQuery }>,
	reply: FastifyReply,
) {
	const { materialTypeId, q } = request.query;

	const results = await searchMaterials(
		request.userId,
		materialTypeId,
		q ?? '',
	);
	return successResponse(reply, results);
}

export async function handleGetOrCreateMaterial(
	request: FastifyRequest<{ Body: GetOrCreateMaterialRequest }>,
	reply: FastifyReply,
) {
	const { material_type_id, color, size, purchase_url } = request.body;

	const material = await getOrCreateMaterial(
		request.userId,
		material_type_id,
		color,
		size,
		purchase_url,
	);

	if (!material) throw AppError.badRequest('Connect a store first');
	return successResponse(reply, material);
}

export async function handleCopyBomFromVariant(
	request: FastifyRequest<{ Body: CopyBomRequest }>,
	reply: FastifyReply,
) {
	const { targetVariantId, sourceVariantId } = request.body;

	const items = await copyBomFromVariant(
		request.userId,
		targetVariantId,
		sourceVariantId,
	);

	return successResponse(reply, items, 'BOM copied successfully');
}

export async function handleGetBomSuggestions(
	request: FastifyRequest<{ Querystring: SuggestionsQuery }>,
	reply: FastifyReply,
) {
	const query = request.query.q ?? '';
	if (query.length < 2) return successResponse(reply, []);

	const suggestions = await getBomSuggestions(request.userId, query);
	return successResponse(reply, suggestions);
}
