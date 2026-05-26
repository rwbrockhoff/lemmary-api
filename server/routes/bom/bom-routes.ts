import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ApiTags } from '../../openapi/tags.js';
import { successSchema } from '../../openapi/schemas.js';
import {
	CreateBomItemRequestSchema,
	UpdateBomItemRequestSchema,
	GetOrCreateMaterialRequestSchema,
	CopyBomRequestSchema,
	BomVariantQuerySchema,
	MaterialTypeSearchQuerySchema,
	MaterialSearchQuerySchema,
	SuggestionsQuerySchema,
	BomItemIdParamSchema,
	MaterialSchema,
	BomItemSchema,
	MaterialTypesResponseSchema,
	MaterialCatalogResponseSchema,
	MaterialSearchResponseSchema,
	BomSuggestionsResponseSchema,
	GetBomResponseSchema,
} from './contract/schemas.js';
import {
	handleGetMaterialTypes,
	handleSearchMaterialTypes,
	handleSearchMaterialCatalog,
	handleSearchMaterials,
	handleGetOrCreateMaterial,
	handleGetBomForVariant,
	handleCreateBomItem,
	handleUpdateBomItem,
	handleDeleteBomItem,
	handleGetBomSuggestions,
	handleCopyBomFromVariant,
} from './bom-controller.js';

export async function bomRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.get(
		'/bom/material-types',
		{
			schema: {
				tags: [ApiTags.BOM],
				summary: 'List material types',
				response: { 200: successSchema(MaterialTypesResponseSchema) },
			},
		},
		handleGetMaterialTypes,
	);

	r.get(
		'/bom/material-types/search',
		{
			schema: {
				tags: [ApiTags.BOM],
				summary: 'Search material types',
				querystring: MaterialTypeSearchQuerySchema,
				response: { 200: successSchema(MaterialTypesResponseSchema) },
			},
		},
		handleSearchMaterialTypes,
	);

	r.get(
		'/bom/materials/catalog',
		{
			schema: {
				tags: [ApiTags.BOM],
				summary: 'Search the material catalog',
				querystring: MaterialTypeSearchQuerySchema,
				response: { 200: successSchema(MaterialCatalogResponseSchema) },
			},
		},
		handleSearchMaterialCatalog,
	);

	r.get(
		'/bom/materials/search',
		{
			schema: {
				tags: [ApiTags.BOM],
				summary: 'Search materials within a material type',
				querystring: MaterialSearchQuerySchema,
				response: { 200: successSchema(MaterialSearchResponseSchema) },
			},
		},
		handleSearchMaterials,
	);

	r.post(
		'/bom/materials',
		{
			schema: {
				tags: [ApiTags.BOM],
				summary: 'Get or create a material',
				body: GetOrCreateMaterialRequestSchema,
				response: { 200: successSchema(MaterialSchema) },
			},
		},
		handleGetOrCreateMaterial,
	);

	r.get(
		'/bom/suggestions',
		{
			schema: {
				tags: [ApiTags.BOM],
				summary: 'Autocomplete BOM piece suggestions',
				querystring: SuggestionsQuerySchema,
				response: { 200: successSchema(BomSuggestionsResponseSchema) },
			},
		},
		handleGetBomSuggestions,
	);

	r.get(
		'/bom',
		{
			schema: {
				tags: [ApiTags.BOM],
				summary: 'Get the bill of materials for a variant',
				querystring: BomVariantQuerySchema,
				response: { 200: successSchema(GetBomResponseSchema) },
			},
		},
		handleGetBomForVariant,
	);

	r.post(
		'/bom/copy',
		{
			schema: {
				tags: [ApiTags.BOM],
				summary: "Copy a variant's BOM to another variant",
				body: CopyBomRequestSchema,
				response: { 200: successSchema(GetBomResponseSchema) },
			},
		},
		handleCopyBomFromVariant,
	);

	r.post(
		'/bom',
		{
			schema: {
				tags: [ApiTags.BOM],
				summary: 'Create a BOM item',
				body: CreateBomItemRequestSchema,
				response: { 201: successSchema(BomItemSchema) },
			},
		},
		handleCreateBomItem,
	);

	r.put(
		'/bom/:bomItemId',
		{
			schema: {
				tags: [ApiTags.BOM],
				summary: 'Update a BOM item',
				params: BomItemIdParamSchema,
				body: UpdateBomItemRequestSchema,
				response: { 200: successSchema(BomItemSchema) },
			},
		},
		handleUpdateBomItem,
	);

	r.delete(
		'/bom/:bomItemId',
		{
			schema: {
				tags: [ApiTags.BOM],
				summary: 'Delete a BOM item',
				params: BomItemIdParamSchema,
				response: { 200: successSchema(z.null()) },
			},
		},
		handleDeleteBomItem,
	);
}
