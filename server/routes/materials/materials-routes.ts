import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ApiTags } from '../../openapi/tags.js';
import { successSchema } from '../../openapi/schemas.js';
import {
	MaterialIdParamSchema,
	CreateMaterialRequestSchema,
	UpdateMaterialRequestSchema,
	MaterialSchema,
	MaterialsResponseSchema,
} from './contract/schemas.js';
import {
	handleGetMaterials,
	handleCreateMaterial,
	handleUpdateMaterial,
	handleDeleteMaterial,
} from './materials-controller.js';

export async function materialsRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.get(
		'/materials',
		{
			schema: {
				tags: [ApiTags.MATERIALS],
				summary: 'List saved materials with usage counts',
				response: { 200: successSchema(MaterialsResponseSchema) },
			},
		},
		handleGetMaterials,
	);

	r.post(
		'/materials',
		{
			schema: {
				tags: [ApiTags.MATERIALS],
				summary: 'Add a material to the library',
				body: CreateMaterialRequestSchema,
				response: { 201: successSchema(MaterialSchema) },
			},
		},
		handleCreateMaterial,
	);

	r.patch(
		'/materials/:materialId',
		{
			schema: {
				tags: [ApiTags.MATERIALS],
				summary: 'Update a material',
				params: MaterialIdParamSchema,
				body: UpdateMaterialRequestSchema,
				response: { 200: successSchema(MaterialSchema) },
			},
		},
		handleUpdateMaterial,
	);

	r.delete(
		'/materials/:materialId',
		{
			schema: {
				tags: [ApiTags.MATERIALS],
				summary: 'Delete a material',
				params: MaterialIdParamSchema,
				response: { 200: successSchema(z.null()) },
			},
		},
		handleDeleteMaterial,
	);
}
