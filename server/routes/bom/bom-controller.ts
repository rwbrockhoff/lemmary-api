import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	createdSuccess,
	notFound,
	badRequest,
	internalError,
} from '../../utils/api-responses.js';
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
	try {
		const materialTypes = await getMaterialTypes(request.userId);
		return successResponse(reply, materialTypes);
	} catch (error) {
		request.log.error(error, 'Failed to fetch material types');
		return internalError(reply);
	}
}

export async function handleGetBomForVariant(
	request: FastifyRequest<{ Querystring: BomVariantQuery }>,
	reply: FastifyReply,
) {
	try {
		const bom = await getBomForVariant(request.userId, request.query.variantId);
		return successResponse(reply, bom);
	} catch (error) {
		request.log.error(error, 'Failed to fetch BOM for variant');
		return internalError(reply);
	}
}

export async function handleCreateBomItem(
	request: FastifyRequest<{ Body: CreateBomItemRequest }>,
	reply: FastifyReply,
) {
	try {
		const item = await createBomItem(request.userId, request.body);
		if (!item) return badRequest(reply, 'Connect a store first');
		return createdSuccess(reply, item, 'BOM item created');
	} catch (error) {
		request.log.error(error, 'Failed to create BOM item');
		return internalError(reply, 'Failed to create BOM item');
	}
}

export async function handleUpdateBomItem(
	request: FastifyRequest<{
		Params: { bomItemId: string };
		Body: UpdateBomItemRequest;
	}>,
	reply: FastifyReply,
) {
	try {
		const item = await updateBomItem(
			request.userId,
			request.params.bomItemId,
			request.body,
		);

		if (!item) {
			return notFound(reply, 'BOM item not found');
		}

		return successResponse(reply, item, 'BOM item updated');
	} catch (error) {
		request.log.error(error, 'Failed to update BOM item');
		return internalError(reply, 'Failed to update BOM item');
	}
}

export async function handleDeleteBomItem(
	request: FastifyRequest<{ Params: { bomItemId: string } }>,
	reply: FastifyReply,
) {
	try {
		const deleted = await deleteBomItem(
			request.userId,
			request.params.bomItemId,
		);

		if (!deleted) {
			return notFound(reply, 'BOM item not found');
		}

		return successResponse(reply, null, 'BOM item deleted');
	} catch (error) {
		request.log.error(error, 'Failed to delete BOM item');
		return internalError(reply, 'Failed to delete BOM item');
	}
}

export async function handleSearchMaterialTypes(
	request: FastifyRequest<{ Querystring: MaterialTypeSearchQuery }>,
	reply: FastifyReply,
) {
	try {
		const query = request.query.q ?? '';
		if (query.length < 1) {
			return successResponse(reply, []);
		}

		const results = await searchMaterialTypes(
			request.userId,
			query,
			request.query.measurement,
		);
		return successResponse(reply, results);
	} catch (error) {
		request.log.error(error, 'Failed to search material types');
		return internalError(reply);
	}
}

export async function handleSearchMaterialCatalog(
	request: FastifyRequest<{ Querystring: MaterialTypeSearchQuery }>,
	reply: FastifyReply,
) {
	try {
		const query = request.query.q ?? '';
		if (query.length < 1) {
			return successResponse(reply, []);
		}

		const results = await searchMaterialCatalog(
			request.userId,
			query,
			request.query.measurement,
		);
		return successResponse(reply, results);
	} catch (error) {
		request.log.error(error, 'Failed to search material catalog');
		return internalError(reply);
	}
}

export async function handleSearchMaterials(
	request: FastifyRequest<{ Querystring: MaterialSearchQuery }>,
	reply: FastifyReply,
) {
	try {
		const { materialTypeId, q } = request.query;

		const results = await searchMaterials(
			request.userId,
			materialTypeId,
			q ?? '',
		);
		return successResponse(reply, results);
	} catch (error) {
		request.log.error(error, 'Failed to search materials');
		return internalError(reply);
	}
}

export async function handleGetOrCreateMaterial(
	request: FastifyRequest<{ Body: GetOrCreateMaterialRequest }>,
	reply: FastifyReply,
) {
	try {
		const { material_type_id, color, size, purchase_url } = request.body;

		const material = await getOrCreateMaterial(
			request.userId,
			material_type_id,
			color,
			size,
			purchase_url,
		);

		if (!material) return badRequest(reply, 'Connect a store first');
		return successResponse(reply, material);
	} catch (error) {
		request.log.error(error, 'Failed to get or create material');
		return internalError(reply);
	}
}

export async function handleCopyBomFromVariant(
	request: FastifyRequest<{ Body: CopyBomRequest }>,
	reply: FastifyReply,
) {
	try {
		const { targetVariantId, sourceVariantId } = request.body;

		const items = await copyBomFromVariant(
			request.userId,
			targetVariantId,
			sourceVariantId,
		);

		return successResponse(reply, items, 'BOM copied successfully');
	} catch (error) {
		request.log.error(error, 'Failed to copy BOM from variant');
		return internalError(reply, 'Failed to copy BOM');
	}
}

export async function handleGetBomSuggestions(
	request: FastifyRequest<{ Querystring: SuggestionsQuery }>,
	reply: FastifyReply,
) {
	try {
		const query = request.query.q ?? '';
		if (query.length < 2) {
			return successResponse(reply, []);
		}

		const suggestions = await getBomSuggestions(request.userId, query);
		return successResponse(reply, suggestions);
	} catch (error) {
		request.log.error(error, 'Failed to fetch BOM suggestions');
		return internalError(reply);
	}
}
