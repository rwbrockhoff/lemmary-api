import { z } from 'zod';

const MeasurementSchema = z.enum(['area', 'linear', 'count']);

// --- request bodies ---
export const CreateBomItemRequestSchema = z.object({
	measurement: MeasurementSchema,
	platform_sku: z.string(),
	product_name: z.string(),
	variant: z.string().nullable(),
	piece: z.string().min(1),
	length: z.string().nullable(),
	quantity: z.number(),
	material_id: z.uuid().nullable(),
});

export const UpdateBomItemRequestSchema = z.object({
	piece: z.string().min(1),
	length: z.string().nullable(),
	quantity: z.number(),
	measurement: MeasurementSchema,
	material_type_id: z.uuid().nullable(),
	material_type_name: z.string().nullable(),
	color: z.string().nullable(),
	size: z.string().nullable(),
	purchase_url: z.string().nullable(),
});

export const GetOrCreateMaterialRequestSchema = z.object({
	material_type_id: z.uuid(),
	color: z.string().nullable(),
	size: z.string().nullable(),
	purchase_url: z.string().nullable(),
});

export const CopyBomRequestSchema = z.object({
	targetVariantId: z.uuid(),
	sourceVariantId: z.uuid(),
});

// --- query params ---
export const BomVariantQuerySchema = z.object({
	variantId: z.uuid(),
});

export const MaterialTypeSearchQuerySchema = z.object({
	q: z.string().optional(),
	measurement: MeasurementSchema.optional(),
});

export const MaterialSearchQuerySchema = z.object({
	materialTypeId: z.uuid(),
	q: z.string().optional(),
});

export const SuggestionsQuerySchema = z.object({
	q: z.string().optional(),
});

export const BomItemIdParamSchema = z.object({
	bomItemId: z.uuid(),
});

// --- row schemas ---
export const BomMaterialTypeSchema = z.object({
	id: z.string(),
	store_id: z.string(),
	name: z.string(),
	measurement: z.enum(['count', 'linear', 'area']),
	unit: z.enum(['pieces', 'inches', 'sq_ft', 'yards']),
	tracks_color: z.boolean(),
	tracks_size: z.boolean(),
	position: z.number(),
	created_at: z.date(),
	updated_at: z.date(),
});

export const MaterialSchema = z.object({
	id: z.string(),
	store_id: z.string(),
	material_type_id: z.string(),
	color: z.string().nullable(),
	size: z.string().nullable(),
	purchase_url: z.string().nullable(),
	created_at: z.date(),
	updated_at: z.date(),
});

export const BomItemSchema = z.object({
	id: z.string(),
	store_id: z.string(),
	material_id: z.string().nullable(),
	measurement: z.enum(['count', 'linear', 'area']),
	platform_sku: z.string(),
	product_name: z.string(),
	variant: z.string().nullable(),
	piece: z.string(),
	length: z.string().nullable(),
	quantity: z.number(),
	position: z.string(),
	created_at: z.date(),
	updated_at: z.date(),
});

const BomItemWithMaterialSchema = BomItemSchema.extend({
	material_type_id: z.string().nullable(),
	material_type_name: z.string().nullable(),
	color: z.string().nullable(),
	size: z.string().nullable(),
	purchase_url: z.string().nullable(),
});

const MaterialCatalogItemSchema = z.object({
	material_type_id: z.string(),
	material_type_name: z.string(),
	color: z.string().nullable(),
	size: z.string().nullable(),
	purchase_url: z.string().nullable(),
});

const MaterialSearchItemSchema = z.object({
	id: z.string(),
	material_type_id: z.string(),
	color: z.string().nullable(),
	size: z.string().nullable(),
	purchase_url: z.string().nullable(),
	material_type_name: z.string(),
});

const BomSuggestionSchema = z.object({
	piece: z.string(),
	material_id: z.string().nullable(),
	measurement: z.enum(['count', 'linear', 'area']),
	length: z.string().nullable(),
	quantity: z.number(),
	color: z.string().nullable(),
	size: z.string().nullable(),
	purchase_url: z.string().nullable(),
	material_type_name: z.string().nullable(),
});

// --- response collections ---
export const MaterialTypesResponseSchema = z.array(BomMaterialTypeSchema);
export const MaterialCatalogResponseSchema = z.array(MaterialCatalogItemSchema);
export const MaterialSearchResponseSchema = z.array(MaterialSearchItemSchema);
export const BomSuggestionsResponseSchema = z.array(BomSuggestionSchema);
export const GetBomResponseSchema = z.array(BomItemWithMaterialSchema);
