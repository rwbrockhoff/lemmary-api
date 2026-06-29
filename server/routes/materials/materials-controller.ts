import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse, createdSuccess } from '../../utils/api-responses.js';
import { AppError } from '../../utils/app-error.js';
import type {
	CreateMaterialRequest,
	UpdateMaterialRequest,
} from './contract/types.js';
import {
	createMaterial,
	getMaterials,
	updateMaterial,
	deleteMaterial,
} from './materials-service.js';

export async function handleCreateMaterial(
	request: FastifyRequest<{ Body: CreateMaterialRequest }>,
	reply: FastifyReply,
) {
	const material = await createMaterial(request.userId, request.body);
	if (!material) throw AppError.badRequest('Connect a store first');
	return createdSuccess(reply, material, 'Material created');
}

export async function handleGetMaterials(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const materials = await getMaterials(request.userId);
	return successResponse(reply, materials);
}

export async function handleUpdateMaterial(
	request: FastifyRequest<{
		Params: { materialId: string };
		Body: UpdateMaterialRequest;
	}>,
	reply: FastifyReply,
) {
	const material = await updateMaterial(
		request.userId,
		request.params.materialId,
		request.body,
	);

	if (!material) throw AppError.notFound('Material not found');
	return successResponse(reply, material, 'Material updated');
}

export async function handleDeleteMaterial(
	request: FastifyRequest<{ Params: { materialId: string } }>,
	reply: FastifyReply,
) {
	const deleted = await deleteMaterial(
		request.userId,
		request.params.materialId,
	);

	if (!deleted) throw AppError.notFound('Material not found');
	return successResponse(reply, null, 'Material deleted');
}
