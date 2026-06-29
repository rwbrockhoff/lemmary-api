import { z } from 'zod';

export const MaterialIdParamSchema = z.object({
	materialId: z.uuid(),
});

export const CreateMaterialRequestSchema = z.object({
	material_type_id: z.uuid().optional(),
	material_type_name: z.string().optional(),
	measurement: z.enum(['area', 'linear', 'count']).optional(),
	color: z.string().nullable().optional(),
	size: z.string().nullable().optional(),
	purchase_url: z.string().nullable().optional(),
});

export const UpdateMaterialRequestSchema = z.object({
	color: z.string().nullable().optional(),
	size: z.string().nullable().optional(),
	purchase_url: z.string().nullable().optional(),
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

export const MaterialListItemSchema = z.object({
	id: z.string(),
	material_type_id: z.string(),
	material_type_name: z.string(),
	measurement: z.enum(['count', 'linear', 'area']),
	color: z.string().nullable(),
	size: z.string().nullable(),
	purchase_url: z.string().nullable(),
	usage_count: z.number(),
	created_at: z.date(),
	updated_at: z.date(),
});

export const MaterialsResponseSchema = z.array(MaterialListItemSchema);
